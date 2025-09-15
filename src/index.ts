import { createHmac, randomUUID } from 'node:crypto';
import type {
    UhaleLogin,
    UhaleOptions,
    UhalePresignedUrl,
    UhaleResponse,
    UhaleTerminal,
    UhaleUser,
} from './types.ts';

export class Uhale {
    private apiUrl: string;
    private userUrl: string;
    private secretKey: string;
    private accessKey: string;
    private sessionId: string | null;
    private user: UhaleUser | null;

    constructor(options?: UhaleOptions) {
        options = options ?? {};

        this.apiUrl =
            options.apiUrl ?? 'https://whalephoto.zeasn.tv/photo/api/v1/web';
        this.userUrl = options.userUrl ?? 'https://saas.zeasn.tv';
        this.secretKey =
            options.secretKey ?? '10f0e356f1d0e64b18b1d02535dc45fb86';
        this.accessKey =
            options.accessKey ?? '12d2f87794d58c4044a7e9d8069a955b70';

        this.sessionId = null;
        this.user = null;
    }

    private async _callApi<T>(url: string, options: RequestInit): Promise<T> {
        const request = await fetch(url, options);
        const response = (await request.json()) as UhaleResponse<T>;

        if (response.errorCode && response.errorCode !== '0') {
            throw new Error(`${response.errorCode}: ${response.errorMsg}`);
        }

        return response.data;
    }

    private async _getSessionId(userToken?: string) {
        let url = this.apiUrl;
        const params = new URLSearchParams();

        if (userToken) {
            url += '/getSessionId';
            params.set('userToken', userToken);
        } else {
            url += '/sessionId';
        }

        const data = await this._callApi<string>(`${url}?${params}`, {
            headers: { sessionId: this.sessionId ?? '' },
        });

        this.sessionId = data;
    }

    async getSessionIdState() {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        const params = new URLSearchParams({ sessionId: this.sessionId });
        const data = await this._callApi<'0' | '1' | '2' | '3' | '4'>(
            `${this.apiUrl}/sessionIdState?${params}`,
            { headers: { sessionId: this.sessionId } },
        );

        const states = {
            0: 'loggedOut',
            1: 'scanned',
            2: 'loggedIn',
            3: 'failed',
            4: 'expired',
        };

        return states[data] ?? 'unknown';
    }

    private _generateSignedToken(path: string) {
        const timestamp = Date.now();
        const signature = createHmac('sha1', this.secretKey)
            .update(path + timestamp)
            .digest('base64');

        return `${this.accessKey}:${signature}:${timestamp}`;
    }

    private async _login(email: string, password: string) {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        const params = new URLSearchParams({ email, pwd: password });
        const data = await this._callApi<UhaleLogin>(
            `${this.userUrl}/user/device/login?${params}`,
            {
                method: 'POST',
                headers: {
                    brandId: '7',
                    productId: '855',
                    sessionId: this.sessionId,
                    authorization:
                        this._generateSignedToken('/user/device/login'),
                },
            },
        );

        this.user = {
            token: data.userToken,
            expiresAt: Number(data.expireAt),
        };
    }

    async login(email: string, password: string) {
        if (!email || !password) {
            throw new Error('email and password are required');
        }

        await this._getSessionId();
        await this._login(email, password);
        await this._getSessionId(this.user!.token);
    }

    waitForLoggedIn(maxAttempts = 5) {
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const checkSessionIdState = async () => {
                try {
                    attempts++;

                    const sessionIdState = await this.getSessionIdState();

                    if (sessionIdState === 'loggedIn') {
                        clearInterval(interval);
                        resolve(null);
                    } else if (
                        sessionIdState === 'failed' ||
                        sessionIdState === 'expired'
                    ) {
                        clearInterval(interval);
                        reject(new Error(`Login ${sessionIdState}`));
                    } else if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        reject(new Error('Polling timeout'));
                    }
                } catch (error) {
                    clearInterval(interval);
                    reject(error);
                }
            };

            const interval = setInterval(checkSessionIdState, 3000);
            checkSessionIdState();
        });
    }

    async getPresignedUrl({
        isImage,
        fileSize,
        terminalId,
        offlineStorage,
    }: {
        isImage: boolean;
        fileSize: number;
        terminalId: string;
        offlineStorage?: boolean;
    }) {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        const params = new URLSearchParams({
            filenameExtension: isImage ? '.jpg' : '.mp4',
            fileSize: fileSize.toString(),
            terminalId,
            offlineStorage: (offlineStorage ?? false).toString(),
            _t: Date.now() / 1000 + randomUUID(),
        });

        return this._callApi<UhalePresignedUrl>(
            `${this.apiUrl}/presignedUrl?${params}`,
            { headers: { sessionId: this.sessionId } },
        );
    }

    async saveUploadedFile({
        fileUrl,
        fileId,
        subject,
        fileSize,
        terminalId,
    }: {
        fileUrl: string;
        fileId: string;
        subject: string;
        fileSize: number;
        terminalId: string;
    }) {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        await this._callApi<string>(`${this.apiUrl}/file`, {
            method: 'POST',
            headers: {
                sessionId: this.sessionId,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                fileUrl,
                fileId,
                fileSize,
                subject,
                terminalId,
            }),
        });
    }

    private async _getFileState(fileIds: string[]) {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        const data = await this._callApi<Record<string, '1' | '2' | '3'>>(
            `${this.apiUrl}/getFileState`,
            {
                method: 'POST',
                headers: {
                    sessionId: this.sessionId,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ fileIds }),
            },
        );

        const states = {
            1: 'pending',
            2: 'uploaded', // image
            3: 'uploaded', // video
        };

        return Object.entries(data).map(([fileId, fileState]) => [
            fileId,
            states[fileState] ?? fileState ?? 'unknown',
        ]);
    }

    waitForFilesUploaded(fileIds: string[], maxAttempts = Infinity) {
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const checkFileStates = async () => {
                try {
                    attempts++;

                    const fileStates = await this._getFileState(fileIds);

                    if (
                        fileStates.every(
                            ([_fileId, fileState]) => fileState === 'uploaded',
                        )
                    ) {
                        clearInterval(interval);
                        resolve(null);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        reject(new Error('Polling timeout'));
                    }
                } catch (error) {
                    clearInterval(interval);
                    reject(error);
                }
            };

            const interval = setInterval(checkFileStates, 3000);
            checkFileStates();
        });
    }

    async uploadFile({
        isImage,
        file,
        fileSize,
        terminalId,
        subject = '',
    }: {
        isImage: boolean;
        file: any; // TODO: figure out which type to put here
        fileSize: number;
        terminalId: string;
        subject?: string;
    }) {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        fileSize = fileSize ?? file.length;

        const { awsUploadUrl, fileUrl, fileId } = await this.getPresignedUrl({
            isImage,
            fileSize,
            terminalId,
        });

        await fetch(awsUploadUrl, {
            method: 'PUT',
            body: file,
        });

        await this.saveUploadedFile({
            fileUrl,
            fileId,
            fileSize,
            subject,
            terminalId,
        });

        await this.waitForFilesUploaded([fileId]);

        return fileId;
    }

    async revokeFiles(terminalId: string, fileIds: string[]) {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        return this._callApi<string[]>(`${this.apiUrl}/revoke`, {
            method: 'POST',
            headers: {
                sessionId: this.sessionId,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                terminalId,
                fileIds,
                offlineStorage: false,
            }),
        });
    }

    private async _getFileRevokeState(fileIds: string[]) {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        const params = new URLSearchParams({ fileIds: fileIds.join(',') });
        const data = await this._callApi<Record<string, '1' | '2'>>(
            `${this.apiUrl}/revoke?${params}`,
            { headers: { sessionId: this.sessionId } },
        );

        const states = {
            1: 'pending',
            2: 'revoked',
        };

        return Object.entries(data).map(([fileId, fileState]) => [
            fileId,
            states[fileState] ?? 'unknown',
        ]);
    }

    waitForFilesRevoked(fileIds: string[], maxAttempts = Infinity) {
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const checkFileStates = async () => {
                try {
                    attempts++;

                    const fileStates = await this._getFileRevokeState(fileIds);

                    if (
                        fileStates.every(
                            ([_fileId, fileState]) => fileState === 'revoked',
                        )
                    ) {
                        clearInterval(interval);
                        resolve(null);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        reject(new Error('Polling timeout'));
                    }
                } catch (error) {
                    clearInterval(interval);
                    reject(error);
                }
            };

            const interval = setInterval(checkFileStates, 3000);
            checkFileStates();
        });
    }

    async getTerminals() {
        if (!this.sessionId) {
            throw new Error('no session id');
        }

        return this._callApi<UhaleTerminal[]>(`${this.apiUrl}/terminal`, {
            headers: { sessionId: this.sessionId },
        });
    }
}
