export interface Video {
    path: string;
    title: string;
    description: string;
    tags?: string[];
    language?: string;
    playlist?: string;
    function?: any;
    thumbnail?: string;
    onSuccess?: Function;
    skipProcessingWait?: boolean;
    onProgress?: (arg0: VideoProgress) => void;
}
export declare enum ProgressEnum {
    Uploading = 0,
    Processing = 1,
    Done = 2
}
export interface VideoProgress {
    progress: number;
    stage: ProgressEnum;
}
export interface VideoToEdit {
    link: string;
    title?: string;
    description?: string;
    tags?: string[];
    replaceTags?: string[];
    language?: string;
    playlist?: string;
    function?: any;
    thumbnail?: string;
    publishType?: 'private' | 'unlisted' | 'public' | 'public&premiere';
    onSuccess?: Function;
}
export interface Comment {
    link: string;
    comment: string;
    live?: boolean;
    onSuccess?: Function;
}
export interface Credentials {
    email: string;
    pass: string;
    recoveryemail?: string | undefined;
}
//# sourceMappingURL=types.d.ts.map