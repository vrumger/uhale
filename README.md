# Uhale

A TypeScript/JavaScript library for interacting with the Uhale API, providing functionality for file uploads, user authentication, and terminal management.

## Installation

```bash
npm install uhale
```

## Quick Start

```typescript
import { Uhale } from 'uhale';

const uhale = new Uhale();

// Login with email and password
await uhale.login('your-email@example.com', 'your-password');

// Upload a file
const fileId = await uhale.uploadFile({
    isImage: true,
    file: fileBuffer,
    fileSize: fileBuffer.length,
    terminalId: 'your-terminal-id',
    subject: 'Optional file description',
});
```

## Configuration

### Constructor Options

```typescript
type UhaleOptions = {
    apiUrl?: string; // Default: 'https://whalephoto.zeasn.tv/photo/api/v1/web'
    userUrl?: string; // Default: 'https://saas.zeasn.tv'
    secretKey?: string; // Default: provided
    accessKey?: string; // Default: provided
};
```

## Authentication

### Login with Email/Password

```typescript
await uhale.login('email@example.com', 'password');
```

### Check Session State

```typescript
const state = await uhale.getSessionIdState();
// Returns: 'loggedOut' | 'scanned' | 'loggedIn' | 'failed' | 'expired' | 'unknown'
```

### Wait for Login Confirmation

```typescript
await uhale.waitForLoggedIn();
```

## File Operations

### Upload Files

```typescript
const fileId = await uhale.uploadFile({
    isImage: boolean, // true for images, false for videos
    file: Buffer | Blob, // File data
    fileSize: number, // Size in bytes
    terminalId: string, // Target terminal ID
    subject: string, // Optional description
});
```

### Get Presigned Upload URL

```typescript
const urlData = await uhale.getPresignedUrl({
    isImage: boolean,
    fileSize: number,
    terminalId: string,
    offlineStorage: boolean, // Default: false
});

// Returns:
// {
//     awsUploadUrl: string,
//     fileUrl: string,
//     fileId: string
// }
```

### Save Uploaded File

```typescript
await uhale.saveUploadedFile({
    fileUrl: string,
    fileId: string,
    subject: string,
    fileSize: number,
    terminalId: string,
});
```

### Wait for Files to be Processed

```typescript
await uhale.waitForFilesUploaded(fileIds);
```

## File Management

### Revoke Files

```typescript
await uhale.revokeFiles(terminalId, fileIds);
```

### Wait for Files to be Revoked

```typescript
await uhale.waitForFilesRevoked(fileIds);
```

## Terminal Management

### Get Available Terminals

```typescript
const terminals = await uhale.getTerminals();

// Returns array of UhaleTerminal objects with properties:
// - terminalId: string
// - name: string
// - state: string
// - location: string
// - availableSpace: string
// - offlineStorage: string
// - ... and more
```

## Error Handling

The library throws errors for various conditions:

```typescript
try {
    await uhale.login('email', 'password');
} catch (error) {
    // Handle authentication errors
    console.error('Login failed:', error.message);
}

try {
    await uhale.uploadFile({
        /* ... */
    });
} catch (error) {
    // Handle upload errors
    console.error('Upload failed:', error.message);
}
```

Common error scenarios:

-   No session ID available
-   Invalid credentials
-   API errors with error codes
-   Network timeouts
-   File upload failures

## TypeScript Support

The library is written in TypeScript and includes full type definitions. Key types include:

-   `UhaleOptions` - Constructor configuration
-   `UhaleTerminal` - Terminal information
-   `UhalePresignedUrl` - Upload URL response
-   `UhaleUser` - User session data
-   `UhaleResponse<T>` - API response wrapper

## Example: Complete File Upload Flow

```typescript
import { Uhale } from 'uhale';
import { readFileSync } from 'fs';

async function uploadImage() {
    const uhale = new Uhale();

    try {
        // 1. Authenticate
        await uhale.login('user@example.com', 'password');
        await uhale.waitForLoggedIn();

        // 2. Get available terminals
        const terminals = await uhale.getTerminals();
        const terminalId = terminals[0].terminalId;

        // 3. Read file
        const fileBuffer = readFileSync('image.jpg');

        // 4. Upload file
        const fileId = await uhale.uploadFile({
            isImage: true,
            file: fileBuffer,
            fileSize: fileBuffer.length,
            terminalId: terminalId,
            subject: 'My uploaded image',
        });

        console.log('File uploaded successfully:', fileId);
    } catch (error) {
        console.error('Upload failed:', error.message);
    }
}
```
