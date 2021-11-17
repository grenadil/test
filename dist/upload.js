"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.comment = exports.update = exports.upload = void 0;
const types_1 = require("./types");
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer_extra_1.default.use(StealthPlugin());
const maxTitleLen = 100;hhrr
const maxDescLen = 5000;
const timeout = 60000hhrrf;
const height = 900;
const width = 900; but
let browser, page;
let cookiesDirPath;
let cookiesFilePath;
const uploadURL = 'https://www.youtube.com/upload';
const homePageURL = 'https://www.youtube.com';
/**
 * import { upload } from 'youtube-videos-uploader'
 * or
 * const { upload } = require('youtube-videos-uploader');
 */
const upload = (credentials, videos, puppeteerLaunch) => __awaiter(void 0, void 0, void 0, function* () {
    cookiesDirPath = path_1.default.join('.', 'yt-auth');
    cookiesFilePath = path_1.default.join(cookiesDirPath, `cookies-${credentials.email.split('@')[0].replace(/\./g, '_')}-${credentials.email
        .split('@')[1]
        .replace(/\./g, '_')}.json`);
    yield launchBrowser({
    headless: headless,
    args: ['--no-sandbox','--disable-setuid-sandbox','--start-maximized'/*, '--incognito'*/],
  });
    yield loadAccount(credentials);
    const uploadedYTLink = [];
    for (const video of videos) {
        const link = yield uploadVideo(video);
        const { onSuccess } = video;
        if (typeof onSuccess === 'function') {
            onSuccess(link);
        }
        uploadedYTLink.push(link);
    }
    yield browser.close();
    return uploadedYTLink;
});
exports.upload = upload;
// `videoJSON = {}`, avoid `videoJSON = undefined` throw error.
function uploadVideo(videoJSON) {
    return __awaiter(this, void 0, void 0, function* () {
        const pathToFile = videoJSON.path;
        if (!pathToFile) {
            throw new Error("function `upload`'s second param `videos`'s item `video` must include `path` property.");
        }
        const title = videoJSON.title;
        const description = videoJSON.description;
        const tags = videoJSON.tags;
        // For backward compatablility playlist.name is checked first
        const playlistName = videoJSON.playlist;
        const videoLang = videoJSON.language;
        const thumb = videoJSON.thumbnail;
        yield page.evaluate(() => {
            window.onbeforeunload = null;
        });
        yield page.goto(uploadURL);
        const closeBtnXPath = "//*[normalize-space(text())='Close']";
        const selectBtnXPath = "//*[normalize-space(text())='Select files']";
        for (let i = 0; i < 2; i++) {
            try {
                yield page.waitForXPath(selectBtnXPath);
                yield page.waitForXPath(closeBtnXPath);
                break;
            }
            catch (error) {
                const nextText = i === 0 ? ' trying again' : ' failed again';
                console.log('Failed to find the select files button', nextText);
                console.error(error);
                yield page.evaluate(() => {
                    window.onbeforeunload = null;
                });
                yield page.goto(uploadURL);
            }
        }
        // Remove hidden closebtn text
        const closeBtn = yield page.$x(closeBtnXPath);
        yield page.evaluate((el) => {
            el.textContent = 'oldclosse';
        }, closeBtn[0]);
        const selectBtn = yield page.$x(selectBtnXPath);
        const [fileChooser] = yield Promise.all([
            page.waitForFileChooser(),
            selectBtn[0].click() // button that triggers file selection
        ]);
        yield fileChooser.accept([pathToFile]);
        // Setup onProgress
        let progressChecker;
        let progress = { progress: 0, stage: types_1.ProgressEnum.Uploading };
        if (videoJSON.onProgress) {
            videoJSON.onProgress(progress);
            progressChecker = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                let curProgress = yield page.evaluate(() => {
                    let items = document.querySelectorAll("span.progress-label.ytcp-video-upload-progress");
                    for (let i = 0; i < items.length; i++) {
                        if (items.item(i).textContent.indexOf("%") === -1)
                            continue;
                        return items.item(i).textContent;
                    }
                });
                if (progressChecker == undefined || !curProgress)
                    return;
                curProgress = curProgress.split(" ").find((txt) => txt.indexOf("%") != -1);
                let newProgress = curProgress ? parseInt(curProgress.slice(0, -1)) : 0;
                if (progress.progress == newProgress)
                    return;
                progress.progress = newProgress;
                videoJSON.onProgress(progress);
            }), 500);
        }
        // Wait for upload to complete
        yield page.waitForXPath('//*[contains(text(),"Upload complete")]', { timeout: 0 });
        if (videoJSON.onProgress) {
            progress = { progress: 0, stage: types_1.ProgressEnum.Processing };
            videoJSON.onProgress(progress);
        }
        // Wait for upload to go away and processing to start, skip the wait if the user doesn't want it.
        if (!videoJSON.skipProcessingWait) {
            yield page.waitForXPath('//*[contains(text(),"Upload complete")]', { hidden: true, timeout: 0 });
        }
        else {
            yield sleep(5000);
        }
        if (videoJSON.onProgress) {
            clearInterval(progressChecker);
            progressChecker = undefined;
            progress = { progress: 100, stage: types_1.ProgressEnum.Done };
            videoJSON.onProgress(progress);
        }
        // Wait until title & description box pops up
        if (thumb) {
            const [thumbChooser] = yield Promise.all([
                page.waitForFileChooser(),
                yield page.waitForSelector(`[class="remove-default-style style-scope ytcp-thumbnails-compact-editor-uploader"]`),
                yield page.click(`[class="remove-default-style style-scope ytcp-thumbnails-compact-editor-uploader"]`)
            ]);
            yield thumbChooser.accept([thumb]);
        }
        yield page.waitForFunction('document.querySelectorAll(\'[id="textbox"]\').length > 1');
        const textBoxes = yield page.$x('//*[@id="textbox"]');
        yield page.bringToFront();
        // Add the title value
        yield textBoxes[0].focus();
        yield page.waitForTimeout(1000);
        yield textBoxes[0].type(title.substring(0, maxTitleLen));
        // Add the Description content
        yield textBoxes[1].type(description.substring(0, maxDescLen));
        const childOption = yield page.$x('//*[contains(text(),"No, it\'s")]');
        yield childOption[0].click();
        const moreOption = yield page.$x("//*[normalize-space(text())='Show more']");
        yield moreOption[0].click();
        const playlist = yield page.$x("//*[normalize-space(text())='Select']");
        let createplaylistdone;
        if (playlistName) {
            // Selecting playlist
            for (let i = 0; i < 2; i++) {
                try {
                    yield page.evaluate((el) => el.click(), playlist[0]);
                    // Type the playlist name to filter out
                    yield page.waitForSelector('#search-input');
                    yield page.focus(`#search-input`);
                    yield page.type(`#search-input`, playlistName);
                    const playlistToSelectXPath = "//*[normalize-space(text())='" + playlistName + "']";
                    yield page.waitForXPath(playlistToSelectXPath, { timeout: 10000 });
                    const playlistNameSelector = yield page.$x(playlistToSelectXPath);
                    yield page.evaluate((el) => el.click(), playlistNameSelector[0]);
                    createplaylistdone = yield page.$x("//*[normalize-space(text())='Done']");
                    yield page.evaluate((el) => el.click(), createplaylistdone[0]);
                    break;
                }
                catch (error) {
                    // Creating new playlist
                    // click on playlist dropdown
                    yield page.evaluate((el) => el.click(), playlist[0]);
                    // click New playlist button
                    const newPlaylistXPath = "//*[normalize-space(text())='New playlist'] | //*[normalize-space(text())='Create playlist']";
                    yield page.waitForXPath(newPlaylistXPath);
                    const createplaylist = yield page.$x(newPlaylistXPath);
                    yield page.evaluate((el) => el.click(), createplaylist[0]);
                    // Enter new playlist name
                    yield page.keyboard.type(' ' + playlistName.substring(0, 148));
                    // click create & then done button
                    const createplaylistbtn = yield page.$x("//*[normalize-space(text())='Create']");
                    yield page.evaluate((el) => el.click(), createplaylistbtn[1]);
                    createplaylistdone = yield page.$x("//*[normalize-space(text())='Done']");
                    yield page.evaluate((el) => el.click(), createplaylistdone[0]);
                }
            }
        }
        // Add tags
        if (tags) {
            yield page.focus(`[aria-label="Tags"]`);
            yield page.type(`[aria-label="Tags"]`, tags.join(', ').substring(0, 495) + ', ');
        }
        // Selecting video language
        if (videoLang) {
            const langHandler = yield page.$x("//*[normalize-space(text())='Video language']");
            yield page.evaluate((el) => el.click(), langHandler[0]);
            // translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
            const langName = yield page.$x('//*[normalize-space(translate(text(),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"))=\'' +
                videoLang.toLowerCase() +
                "']");
            yield page.evaluate((el) => el.click(), langName[langName.length - 1]);
        }
        // click next button
        const nextBtnXPath = "//*[normalize-space(text())='Next']/parent::*[not(@disabled)]";
        yield page.waitForXPath(nextBtnXPath);
        let next = yield page.$x(nextBtnXPath);
        yield next[0].click();
        // await sleep(2000)
        yield page.waitForXPath(nextBtnXPath);
        // click next button
        next = yield page.$x(nextBtnXPath);
        yield next[0].click();
        yield page.waitForXPath(nextBtnXPath);
        // click next button
        next = yield page.$x(nextBtnXPath);
        yield next[0].click();
        //  const publicXPath = `//*[normalize-space(text())='Public']`
        //  await page.waitForXPath(publicXPath)
        //  const publicOption = await page.$x(publicXPath)
        //  await publicOption[0].click()
        // Get publish button
        const publishXPath = "//*[normalize-space(text())='Publish']/parent::*[not(@disabled)] | //*[normalize-space(text())='Save']/parent::*[not(@disabled)]";
        yield page.waitForXPath(publishXPath);
        // save youtube upload link
        yield page.waitForSelector('[href^="https://youtu.be"]');
        const uploadedLinkHandle = yield page.$('[href^="https://youtu.be"]');
        let uploadedLink;
        do {
            yield page.waitForTimeout(500);
            uploadedLink = yield page.evaluate((e) => e.getAttribute('href'), uploadedLinkHandle);
        } while (uploadedLink === 'https://youtu.be/');
        let publish;
        for (let i = 0; i < 10; i++) {
            try {
                publish = yield page.$x(publishXPath);
                yield publish[0].click();
                break;
            }
            catch (error) {
                yield page.waitForTimeout(5000);
            }
        }
        // await page.waitForXPath('//*[contains(text(),"Finished processing")]', { timeout: 0})
        // Wait for closebtn to show up
        try {
            yield page.waitForXPath(closeBtnXPath);
        }
        catch (e) {
            yield browser.close();
            throw new Error('Please make sure you set up your default video visibility correctly, you might have forgotten. More infos : https://github.com/fawazahmed0/youtube-uploader#youtube-setup');
        }
        return uploadedLink;
    });
}
const update = (credentials, videos, puppeteerLaunch) => __awaiter(void 0, void 0, void 0, function* () {
    cookiesDirPath = path_1.default.join('.', 'yt-auth');
    cookiesFilePath = path_1.default.join(cookiesDirPath, `cookies-${credentials.email.split('@')[0].replace(/\./g, '_')}-${credentials.email
        .split('@')[1]
        .replace(/\./g, '_')}.json`);
    yield launchBrowser({
    headless: headless,
    args: ['--no-sandbox','--disable-setuid-sandbox','--start-maximized'/*, '--incognito'*/],
  });
    if (!fs_extra_1.default.existsSync(cookiesFilePath))
        yield loadAccount(credentials);
    const updatedYTLink = [];
    for (const video of videos) {
        console.log(video);
        const link = yield updateVideoInfo(video);
        const { onSuccess } = video;
        if (typeof onSuccess === 'function') {
            onSuccess(link);
        }
        updatedYTLink.push(link);
    }
    yield browser.close();
    return updatedYTLink;
});
exports.update = update;
const comment = (credentials, comments, puppeteerLaunch) => __awaiter(void 0, void 0, void 0, function* () {
    cookiesDirPath = path_1.default.join('.', 'yt-auth');
    cookiesFilePath = path_1.default.join(cookiesDirPath, `cookies-${credentials.email.split('@')[0].replace(/\./g, '_')}-${credentials.email
        .split('@')[1]
        .replace(/\./g, '_')}.json`);
    yield launchBrowser({
    headless: headless,
    args: ['--no-sandbox','--disable-setuid-sandbox','--start-maximized'/*, '--incognito'*/],
  });
    if (!fs_extra_1.default.existsSync(cookiesFilePath))
        yield loadAccount(credentials);
    const commentsS = [];
    for (const comment of comments) {
        let result;
        console.log(comment);
        if (comment.live)
            result = yield pulishLiveComment(comment);
        else
            result = yield pulishComment(comment);
        const { onSuccess } = comment;
        if (typeof onSuccess === 'function') {
            onSuccess(result);
        }
        commentsS.push(result);
    }
    yield browser.close();
    return commentsS;
});
exports.comment = comment;
const pulishComment = (comment) => __awaiter(void 0, void 0, void 0, function* () {
    const videoUrl = comment.link;
    if (!videoUrl) {
        throw new Error('The link of the  video is a required parameter');
    }
    try {
        const cmt = comment.comment;
        yield page.goto(videoUrl);
        yield sleep(2000);
        yield scrollTillVeiw(page, `#placeholder-area`);
        yield page.focus(`#placeholder-area`);
        const commentBox = yield page.$x('//*[@id="placeholder-area"]');
        yield commentBox[0].focus();
        yield commentBox[0].click();
        yield commentBox[0].type(cmt.substring(0, 10000));
        yield page.click('#submit-button');
        return { err: false, data: 'sucess' };
    }
    catch (err) {
        return { err: true, data: err };
    }
});
const pulishLiveComment = (comment) => __awaiter(void 0, void 0, void 0, function* () {
    const videoUrl = comment.link;
    const cmt = comment.comment;
    if (!videoUrl) {
        throw new Error('The link of the  video is a required parameter');
    }
    yield page.goto(videoUrl);
    yield sleep(3000);
    yield scrollTillVeiw(page, `#label`);
    try {
        yield page.focus(`#label`);
    }
    catch (err) {
        console.log(err);
        throw new Error('Video may not be Live');
    }
    for (let i = 0; i < 6; i++) {
        yield autoScroll(page);
    }
    try {
        yield page.focus('#input');
        yield page.mouse.click(450, 480);
        yield page.keyboard.type(cmt.substring(0, 200));
        yield sleep(200);
        yield page.mouse.click(841, 495);
        return { err: false, data: 'sucess' };
    }
    catch (err) {
        return { err: true, data: err };
    }
});
const updateVideoInfo = (videoJSON) => __awaiter(void 0, void 0, void 0, function* () {
    const videoUrl = videoJSON.link;
    if (!videoUrl) {
        throw new Error('The link of the  video is a required parameter');
    }
    const title = videoJSON.title;
    const description = videoJSON.description;
    const tags = videoJSON.tags;
    const Rtags = videoJSON.replaceTags;
    const playlistName = videoJSON.playlist;
    const videoLang = videoJSON.language;
    const thumb = videoJSON.thumbnail;
    const publish = videoJSON.publishType;
    yield page.goto(videoUrl);
    const editXpath = '//*[@id="subscribe-button"]/ytd-button-renderer';
    try {
        yield page.waitForXPath(editXpath, { timeout: 7000 });
    }
    catch (err) {
        throw new Error('The video provided may not be yours');
    }
    let edit = yield page.$x(editXpath);
    yield edit[0].click();
    const titleE = '//*[@id="textbox"]';
    yield page.waitForXPath(titleE, { timeout: 70000 });
    yield page.waitForFunction('document.querySelectorAll(\'[id="textbox"]\').length > 1');
    const textBoxes = yield page.$x('//*[@id="textbox"]');
    yield page.bringToFront();
    // Edit the title value (if)
    yield textBoxes[0].focus();
    yield page.waitForTimeout(1000);
    yield sleep(1000);
    if (title) {
        yield page.keyboard.down('Control');
        yield page.keyboard.press('A');
        yield page.keyboard.up('Control');
        yield page.keyboard.press('Backspace');
        yield textBoxes[0].type(title.substring(0, maxTitleLen));
    }
    // Edit the Description content (if)
    if (description) {
        yield textBoxes[1].focus();
        yield page.keyboard.down('Control');
        yield page.keyboard.press('A');
        yield page.keyboard.up('Control');
        yield page.keyboard.press('Backspace');
        yield textBoxes[1].type(description.substring(0, maxDescLen));
    }
    if (thumb) {
        const [thumbChooser] = yield Promise.all([
            page.waitForFileChooser({ timeout: 500 }).catch(() => __awaiter(void 0, void 0, void 0, function* () {
                console.log('replacing previous thumbanail');
                yield page.click('#still-1 > button');
                yield page.waitForSelector('#save > div');
                yield page.click(`#save > div`);
                yield page.waitForXPath("//*[normalize-space(text())='Save']/parent::*[@disabled]");
                yield sleep(500);
                return yield page.waitForFileChooser();
            })),
            yield page.waitForSelector(`[class="remove-default-style style-scope ytcp-thumbnails-compact-editor-uploader"]`),
            yield page.click(`[class="remove-default-style style-scope ytcp-thumbnails-compact-editor-uploader"]`)
        ]);
        yield thumbChooser.accept([thumb]);
    }
    // await sleep( 10000000)
    const playlist = yield page.$x(`//*[@id="basics"]/div[4]/div[3]/div[1]/ytcp-video-metadata-playlists/ytcp-text-dropdown-trigger/ytcp-dropdown-trigger/div/div[3]`);
    let createplaylistdone;
    if (playlistName) {
        for (let i = 0; i < 2; i++) {
            try {
                yield page.evaluate((el) => el.click(), playlist[0]);
                yield page.waitForSelector('#search-input');
                yield page.focus(`#search-input`);
                yield page.type(`#search-input`, playlistName);
                const playlistToSelectXPath = "//*[normalize-space(text())='" + playlistName + "']";
                yield page.waitForXPath(playlistToSelectXPath, { timeout: 10000 });
                const playlistNameSelector = yield page.$x(playlistToSelectXPath);
                yield page.evaluate((el) => el.click(), playlistNameSelector[0]);
                createplaylistdone = yield page.$x("//*[normalize-space(text())='Done']");
                yield page.evaluate((el) => el.click(), createplaylistdone[0]);
                break;
            }
            catch (error) {
                yield page.evaluate((el) => el.click(), playlist[0]);
                const newPlaylistXPath = "//*[normalize-space(text())='New playlist'] | //*[normalize-space(text())='Create playlist']";
                yield page.waitForXPath(newPlaylistXPath);
                const createplaylist = yield page.$x(newPlaylistXPath);
                yield page.evaluate((el) => el.click(), createplaylist[0]);
                yield page.keyboard.type(' ' + playlistName.substring(0, 148));
                const createplaylistbtn = yield page.$x("//*[normalize-space(text())='Create']");
                yield page.evaluate((el) => el.click(), createplaylistbtn[1]);
                createplaylistdone = yield page.$x("//*[normalize-space(text())='Done']");
                yield page.evaluate((el) => el.click(), createplaylistdone[0]);
            }
        }
    }
    const moreOption = yield page.$x("//*[normalize-space(text())='Show more']");
    yield moreOption[0].click();
    if (tags) {
        yield page.focus(`[aria-label="Tags"]`);
        yield page.type(`[aria-label="Tags"]`, tags.join(', ').substring(0, 495) + ', ');
    }
    if (Rtags) {
        yield page.click('//*[@id="clear-button"]/tp-yt-iron-icon');
        yield page.focus(`[aria-label="Tags"]`);
        yield page.type(`[aria-label="Tags"]`, Rtags.join(', ').substring(0, 495) + ', ');
    }
    if (videoLang) {
        const langHandler = yield page.$x("//*[normalize-space(text())='Video language']");
        yield page.evaluate((el) => el.click(), langHandler[0]);
        const langName = yield page.$x('//*[normalize-space(translate(text(),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"))=\'' +
            videoLang.toLowerCase() +
            "']");
        yield page.evaluate((el) => el.click(), langName[langName.length - 1]);
    }
    yield page.focus(`#content`);
    if (publish) {
        yield page.click(`#content`);
        // await page.click(`#onRadio`);
        const puplishBtn = yield page.$x('//*[@id="first-container"]');
        yield sleep(2000);
        // puplishBtn[0].click()
        try {
            switch (publish) {
                case 'private':
                    yield page
                        .click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(2)`)
                        .catch((err) => __awaiter(void 0, void 0, void 0, function* () {
                        return yield page.click(`#privacy-radios > tp-yt-paper-radio-button.style-scope.ytcp-video-visibility-select.iron-selected`);
                    }));
                    break;
                case 'unlisted':
                    yield page
                        .click(`#privacy-radios > tp-yt-paper-radio-button.style-scope.ytcp-video-visibility-select.iron-selected`)
                        .catch((err) => __awaiter(void 0, void 0, void 0, function* () { return yield page.click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(11)`); }));
                    break;
                case 'public':
                    yield page
                        .click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(15)`)
                        .catch((err) => __awaiter(void 0, void 0, void 0, function* () { return yield page.click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(16)`); }));
                    break;
                case 'public&premiere':
                    yield page.click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(15)`);
                    yield page.click(`#enable-premiere-checkbox`);
                    break;
            }
        }
        catch (err) {
            console.log('already selected');
            yield page.keyboard.press('Escape');
        }
        yield page.click(`#save-button`);
        yield sleep(1200);
    }
    try {
        yield page.focus(`#content`);
        yield page.focus(`#save > div`);
        yield page.waitForSelector('#save > div');
        yield page.click(`#save > div`);
        yield page.waitForXPath("//*[normalize-space(text())='Save']/parent::*[@disabled]");
    }
    catch (err) {
        console.log(err);
        throw new Error('Probably nothing was changed ...');
    }
    //#overflow-menu-button
    return console.log('successfully edited');
});
function loadAccount(credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!fs_extra_1.default.existsSync(cookiesFilePath))
                yield login(page, credentials);
        }
        catch (error) {
            if (error.message === 'Recapcha found') {
                if (browser) {
                    yield browser.close();
                }
                throw error;
            }
            // Login failed trying again to login
            try {
                yield login(page, credentials);
            }
            catch (error) {
                if (browser) {
                    yield browser.close();
                }
                throw error;
            }
        }
        try {
            yield changeHomePageLangIfNeeded(page);
        }
        catch (error) {
            console.error(error);
            yield login(page, credentials);
        }
    });
}
function changeLoginPageLangIfNeeded(localPage) {
    return __awaiter(this, void 0, void 0, function* () {
        const selectedLangSelector = '[aria-selected="true"]';
        try {
            yield localPage.waitForSelector(selectedLangSelector);
        }
        catch (e) {
            throw new Error('Failed to find selected language : ' + e.name);
        }
        const selectedLang = yield localPage.evaluate((selectedLangSelector) => document.querySelector(selectedLangSelector).innerText, selectedLangSelector);
        if (!selectedLang) {
            throw new Error('Failed to find selected language : Empty text');
        }
        if (selectedLang.includes('English')) {
            return;
        }
        yield localPage.click(selectedLangSelector);
        yield localPage.waitForTimeout(1000);
        const englishLangItemSelector = '[role="presentation"]:not([aria-hidden="true"])>[data-value="en-GB"]';
        try {
            yield localPage.waitForSelector(englishLangItemSelector);
        }
        catch (e) {
            throw new Error('Failed to find english language item : ' + e.name);
        }
        yield localPage.click(englishLangItemSelector);
        yield localPage.waitForTimeout(1000);
    });
}
function changeHomePageLangIfNeeded(localPage) {
    return __awaiter(this, void 0, void 0, function* () {
        yield localPage.goto(homePageURL);
        const avatarButtonSelector = 'button#avatar-btn';
        try {
            yield localPage.waitForSelector(avatarButtonSelector);
        }
        catch (e) {
            throw new Error('Avatar/Profile picture button not found : ' + e.name);
        }
        yield localPage.click(avatarButtonSelector);
        const langMenuItemSelector = 'yt-multi-page-menu-section-renderer+yt-multi-page-menu-section-renderer>#items>ytd-compact-link-renderer>a';
        try {
            yield localPage.waitForSelector(langMenuItemSelector);
        }
        catch (e) {
            throw new Error('Language menu item selector/button(">") not found : ' + e.name);
        }
        const selectedLang = yield localPage.evaluate((langMenuItemSelector) => document.querySelector(langMenuItemSelector).innerText, langMenuItemSelector);
        if (!selectedLang) {
            throw new Error('Failed to find selected language : Empty text');
        }
        if (selectedLang.includes('English')) {
            yield localPage.goto(uploadURL);
            return;
        }
        yield localPage.click(langMenuItemSelector);
        const englishItemXPath = "//*[normalize-space(text())='English (UK)']";
        try {
            yield localPage.waitForXPath(englishItemXPath);
        }
        catch (e) {
            throw new Error('English(UK) item selector not found : ' + e.name);
        }
        yield localPage.waitForTimeout(3000);
        yield localPage.evaluate((englishItemXPath) => {
            let element = document === null || document === void 0 ? void 0 : document.evaluate(englishItemXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            element.click();
        }, englishItemXPath);
        yield localPage.goto(uploadURL);
    });
}
function launchBrowser({
    headless: headless,
    args: ['--no-sandbox','--disable-setuid-sandbox','--start-maximized'/*, '--incognito'*/],
  }) {
    return __awaiter(this, void 0, void 0, function* () {
        const previousSession = fs_extra_1.default.existsSync(cookiesFilePath);
        browser = yield puppeteer_extra_1.default.launch({
    headless: headless,
    args: ['--no-sandbox','--disable-setuid-sandbox','--start-maximized'/*, '--incognito'*/],
  });
        page = yield browser.newPage();
        yield page.setDefaultTimeout(timeout);
        if (previousSession) {
            // If file exist load the cookies
            const cookiesString = fs_extra_1.default.readFileSync(cookiesFilePath, { encoding: 'utf-8' });
            const parsedCookies = JSON.parse(cookiesString);
            if (parsedCookies.length !== 0) {
                for (let cookie of parsedCookies) {
                    yield page.setCookie(cookie);
                }
                console.log('Session has been loaded in the browser');
            }
        }
        yield page.setViewport({ width: width, height: height });
        yield page.setBypassCSP(true);
    });
}
function login(localPage, credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        yield localPage.goto(uploadURL);
        yield changeLoginPageLangIfNeeded(localPage);
        const emailInputSelector = 'input[type="email"]';
        yield localPage.waitForSelector(emailInputSelector);
        yield localPage.type(emailInputSelector, credentials.email, { delay: 50 });
        yield localPage.keyboard.press('Enter');
        const passwordInputSelector = 'input[type="password"]:not([aria-hidden="true"])';
        yield localPage.waitForSelector(passwordInputSelector);
        yield localPage.waitForTimeout(3000);
        yield localPage.type(passwordInputSelector, credentials.pass, { delay: 50 });
        yield localPage.keyboard.press('Enter');
        try {
            yield localPage.waitForNavigation();
        }
        catch (error) {
            const recaptchaInputSelector = 'input[aria-label="Type the text you hear or see"]';
            const isOnRecaptchaPage = yield localPage.evaluate((recaptchaInputSelector) => document.querySelector(recaptchaInputSelector) !== null, recaptchaInputSelector);
            if (isOnRecaptchaPage) {
                throw new Error('Recaptcha found');
            }
            throw new Error(error);
        }
        try {
            const uploadPopupSelector = 'ytcp-uploads-dialog';
            yield localPage.waitForSelector(uploadPopupSelector, { timeout: 70000 });
        }
        catch (error) {
            if (credentials.recoveryemail)
                yield securityBypass(localPage, credentials.recoveryemail);
        }
        const cookiesObject = yield localPage.cookies();
        yield fs_extra_1.default.mkdirSync(cookiesDirPath, { recursive: true });
        // Write cookies to temp file to be used in other profile pages
        yield fs_extra_1.default.writeFile(cookiesFilePath, JSON.stringify(cookiesObject), function (err) {
            if (err) {
                console.log('The file could not be written.', err);
            }
            console.log('Session has been successfully saved');
        });
    });
}
// Login bypass with recovery email
function securityBypass(localPage, recoveryemail) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const confirmRecoveryXPath = "//*[normalize-space(text())='Confirm your recovery email']";
            yield localPage.waitForXPath(confirmRecoveryXPath);
            const confirmRecoveryBtn = yield localPage.$x(confirmRecoveryXPath);
            yield localPage.evaluate((el) => el.click(), confirmRecoveryBtn[0]);
        }
        catch (error) {
            console.error(error);
        }
        yield localPage.waitForNavigation({
            waitUntil: 'networkidle0'
        });
        const enterRecoveryXPath = "//*[normalize-space(text())='Enter recovery email address']";
        yield localPage.waitForXPath(enterRecoveryXPath);
        yield localPage.waitForTimeout(5000);
        yield localPage.focus('input[type="email"]');
        yield localPage.waitForTimeout(3000);
        yield localPage.type('input[type="email"]', recoveryemail, { delay: 100 });
        yield localPage.keyboard.press('Enter');
        yield localPage.waitForNavigation({
            waitUntil: 'networkidle0'
        });
        const uploadPopupSelector = 'ytcp-uploads-dialog';
        yield localPage.waitForSelector(uploadPopupSelector, { timeout: 60000 });
    });
}
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((sendMessage) => setTimeout(sendMessage, ms));
    });
}
function autoScroll(page) {
    return __awaiter(this, void 0, void 0, function* () {
        yield page.evaluate(`(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve(0);
                }
            }, 100);
        });
    })()`);
    });
}
function scrollTillVeiw(page, element) {
    return __awaiter(this, void 0, void 0, function* () {
        let sc = true;
        while (sc) {
            try {
                yield page.focus(element);
                sc = false;
            }
            catch (err) {
                yield autoScroll(page);
                sc = true;
            }
        }
        return;
    });
}
//# sourceMappingURL=upload.js.map
