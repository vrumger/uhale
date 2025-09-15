export type UhaleOptions = {
    apiUrl?: string;
    userUrl?: string;
    secretKey?: string;
    accessKey?: string;
};

export type UhaleResponse<T> = {
    errorCode: string;
    errorMsg: string;
    data: T;
};

export type UhaleUser = {
    token: string;
    expiresAt: number;
};

export type UhaleLogin = {
    expireAt: string;
    userInfo: UhaleUserInfo;
    userToken: string;
};

export type UhaleUserInfo = {
    email: string;
    emailBind: string;
    fromSource: string;
    groupId: string;
    icon: string;
    id: string;
    nm: string;
    userType: string;
};

export type UhaleTerminal = {
    availableSpace: string;
    bindState: string;
    bindTime: string;
    clientType: string;
    deviceId: string;
    location: string;
    mac: string;
    name: string;
    offlineStorage: string;
    offlineStorageAvailable: string;
    offlineStorageLimit: string;
    offlineStorageUsed: string;
    primaryAccount: string;
    productId: string;
    resolution: string;
    state: string;
    supportOfflineStorage: string;
    terminalId: string;
    versionCode: string;
};

export type UhalePresignedUrl = {
    awsUploadUrl: string;
    fileUrl: string;
    fileId: string;
};
