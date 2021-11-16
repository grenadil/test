import { Credentials, Video, VideoToEdit, Comment } from './types';
import { PuppeteerNodeLaunchOptions } from 'puppeteer';
/**
 * import { upload } from 'youtube-videos-uploader'
 * or
 * const { upload } = require('youtube-videos-uploader');
 */
export declare const upload: (credentials: Credentials, videos: Video[], puppeteerLaunch?: PuppeteerNodeLaunchOptions | undefined) => Promise<any[]>;
export declare const update: (credentials: Credentials, videos: VideoToEdit[], puppeteerLaunch?: PuppeteerNodeLaunchOptions | undefined) => Promise<void[]>;
export declare const comment: (credentials: Credentials, comments: Comment[], puppeteerLaunch?: PuppeteerNodeLaunchOptions | undefined) => Promise<{
    err: boolean;
    data: unknown;
}[]>;
//# sourceMappingURL=upload.d.ts.map