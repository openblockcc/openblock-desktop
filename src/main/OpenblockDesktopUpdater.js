import {app, dialog} from 'electron';
import {autoUpdater, CancellationToken} from 'electron-updater';
import log from 'electron-log';
import bytes from 'bytes';
import path from 'path';

import formatMessage from 'format-message';
import parseReleaseMessage from 'openblock-parse-release-message';
import {UPDATE_TARGET, UPDATE_MODAL_STATE} from 'openblock-gui/src/lib/update-state.js';
import {AbortController} from 'node-abort-controller';
class OpenblockDesktopUpdater {
    constructor (webContents, resourceServer) {
        this._webContents = webContents;
        this._resourceServer = resourceServer;

        autoUpdater.autoDownload = false;

        const appPath = app.getAppPath();
        if (appPath.search(/main/g) !== -1) {
            autoUpdater.logger = log;
            autoUpdater.logger.transports.file.level = 'info';
            autoUpdater.updateConfigPath = path.join(appPath, '../win-unpacked/resources/app-update.yml');
        }

        this.updaterState = null;
        this.updateTarget = null;
        this.abortController = null;
        this.cancellationToken = null;
    }

    removeAllAutoUpdaterListeners () {
        autoUpdater.removeAllListeners('error');
        autoUpdater.removeAllListeners('update-available');
        autoUpdater.removeAllListeners('update-not-available');
    }

    reportUpdateState (state) {
        this._webContents.send('setUpdate', state);
    }

    applicationAvailable (info) {
        this.updateTarget = UPDATE_TARGET.application;

        this.reportUpdateState({
            phase: UPDATE_MODAL_STATE.applicationUpdateAvailable,
            info: {
                version: info.version,
                message: parseReleaseMessage(info.releaseNotes, {html: true})
            }
        });
    }

    resourceAvailable (info) {
        this.updateTarget = UPDATE_TARGET.resource;
        this.reportUpdateState({
            phase: UPDATE_MODAL_STATE.resourceUpdateAvailable,
            info: {
                version: info.latestVersion,
                message: info.message
            }
        });
    }

    checkUpdateAtStartup () {
        autoUpdater.on('error', err => {
            this.removeAllAutoUpdaterListeners();
            console.warn(`Error while checking for application update: ${err}`);
        });
        autoUpdater.once('update-available', applicationUpdateInfo => {
            this.removeAllAutoUpdaterListeners();
            this.applicationAvailable(applicationUpdateInfo);
        });

        const resourceServerCheckUpdate = () => {
            this._resourceServer.checkUpdate()
                .then(resourceUpdateInfo => {
                    if (resourceUpdateInfo.updateble) {
                        this.resourceAvailable(resourceUpdateInfo);
                    }
                })
                .catch(err => {
                    console.warn(`Error while checking for resource update: ${err}`);
                });
        };

        autoUpdater.once('update-not-available', () => {
            this.removeAllAutoUpdaterListeners();
            resourceServerCheckUpdate();
        });

        if (app.getLocaleCountryCode() !== 'CN') { // eslint-disable-line no-negated-condition
            autoUpdater.checkForUpdates();
        } else {
            // Due to widespread network issues in China, the update of the software itself was skipped.
            resourceServerCheckUpdate();
        }
    }

    reqeustCheckUpdate () {
        autoUpdater.on('error', err => {
            this.removeAllAutoUpdaterListeners();
            if (err.message === 'net::ERR_INTERNET_DISCONNECTED') {
                this.reportUpdateState({
                    phase: UPDATE_MODAL_STATE.error,
                    info: {
                        message: formatMessage({
                            id: 'index.internetDisconnectedError',
                            default: 'Internet disconnected, please verify your internet connection and try again.',
                            description: 'Error message of internet disconnected'
                        })
                    }
                });
            } else if (err.message === 'net::ERR_CONNECTION_TIMED_OUT') {
                this.reportUpdateState({
                    phase: UPDATE_MODAL_STATE.error,
                    info: {
                        message: formatMessage({
                            id: 'index.connectionTimeOut',
                            default: 'Connection timed out. Please check your network status and try again.',
                            description: 'Error message when the connection times out due to a slow or unresponsive network.' // eslint-disable-line max-len
                        })
                    }
                });
            } else {
                this.reportUpdateState({
                    phase: UPDATE_MODAL_STATE.error,
                    info: {
                        message: err.message
                    }
                });
            }
        });
        autoUpdater.once('update-available', applicationUpdateInfo => {
            this.updaterState = UPDATE_MODAL_STATE.applicationUpdateAvailable;
            this.removeAllAutoUpdaterListeners();
            this.applicationAvailable(applicationUpdateInfo);
        });

        const resourceServerCheckUpdate = () => {
            this.abortController = new AbortController();
            this._resourceServer.checkUpdate({signal: this.abortController.signal})
                .then(resourceUpdateInfo => {
                    if (resourceUpdateInfo.updateble) {
                        this.updaterState = UPDATE_MODAL_STATE.resourceUpdateAvailable;
                        this.resourceAvailable(resourceUpdateInfo);
                    } else {
                        this.reportUpdateState({phase: 'latest'});
                    }
                })
                .catch(err => {
                    this.reportUpdateState({phase: 'error', message: err});
                });
            this.updaterState = UPDATE_MODAL_STATE.checkingResource;
        };

        autoUpdater.once('update-not-available', () => {
            this.removeAllAutoUpdaterListeners();
            resourceServerCheckUpdate();
        });

        if (app.getLocaleCountryCode() !== 'CN') { // eslint-disable-line no-negated-condition
            this.updaterState = UPDATE_MODAL_STATE.checkingApplication;
        } else {
            resourceServerCheckUpdate();

            dialog.showMessageBox({
                type: 'info',
                // Since China cannot stably connect to the update server, only the update plug-in content will be
                // checked.If you need to upgrade the software, please go to the official release channel to view
                // and download the latest version of the installation package.
                message: `由于中国地区无法稳定的连接到更新服务器，将仅检查更新插件内容。如果需要升级软件本体请前往官方发布渠道查看和下载最新版本的安装包: https://wiki.openblock.cc/install-desktop-version` // eslint-disable-line max-len
            });
        }
    }

    reqeustUpdate () {
        if (this.updateTarget === UPDATE_TARGET.application) {
            this.cancellationToken = new CancellationToken();
            autoUpdater.downloadUpdate(this.cancellationToken);
            this.updaterState = UPDATE_MODAL_STATE.applicationDownloading;

            const PROGRESS_BASE_VALUE = 0;
            const PROGRESS_DOWNLOADING_PROGRESS_VALUE = 0.1;
            const PROGRESS_STEP_INTERVAL = 0.5; // 0.5s
            const PROGRESS_STEP_TIMEOUT = 20; // 20s
            const PROGRESS_STEP_VALUE = (PROGRESS_DOWNLOADING_PROGRESS_VALUE - PROGRESS_BASE_VALUE) /
                (PROGRESS_STEP_TIMEOUT / PROGRESS_STEP_INTERVAL);

            let downloadInProgress = false;

            const stepProgressBar = progress => {
                this.startDownloadTimeout = setTimeout(() => {
                    if (!downloadInProgress && progress <= PROGRESS_DOWNLOADING_PROGRESS_VALUE) {
                        this.reportUpdateState({
                            phase: UPDATE_MODAL_STATE.applicationDownloading,
                            info: {
                                progress: progress
                            }
                        });
                        stepProgressBar(progress + PROGRESS_STEP_VALUE);
                    } else {
                        this.startDownloadTimeout = null;
                    }
                }, PROGRESS_STEP_INTERVAL * 1000);
            };

            // After start downloading, it takes a while for download-progress event to trigger,
            // report a progress that grows slowly over time let user know the downloading is started and running.
            this.reportUpdateState({
                phase: UPDATE_MODAL_STATE.applicationDownloading,
                info: {
                    progress: PROGRESS_BASE_VALUE
                }
            });
            stepProgressBar(PROGRESS_BASE_VALUE);

            return new Promise((resolve, reject) => {

                autoUpdater.on('error', err => reject(err));

                autoUpdater.on('download-progress', progressObj => {
                    downloadInProgress = true;
                    this.reportUpdateState({
                        phase: UPDATE_MODAL_STATE.applicationDownloading,
                        info: {
                            progress: ((progressObj.percent * (1 - PROGRESS_DOWNLOADING_PROGRESS_VALUE)) +
                                (PROGRESS_DOWNLOADING_PROGRESS_VALUE * 100)) / 100,
                            state: {
                                speed: `${bytes(progressObj.bytesPerSecond)}/s`,
                                total: bytes(progressObj.total),
                                done: bytes(progressObj.transferred)
                            }
                        }
                    });
                });

                autoUpdater.on('update-downloaded', () => {
                    this.reportUpdateState({phase: UPDATE_MODAL_STATE.applicationDownloadFinish});
                    setTimeout(() => {
                        console.log(`INFO: App will quit and install after 3 seconds`);
                        autoUpdater.quitAndInstall();
                    }, 1000 * 3);
                });
            });

        }
        const reportResourceUpdateState = res => {
            if (this.updaterState !== UPDATE_MODAL_STATE.abort) {
                this.reportUpdateState({
                    phase: UPDATE_MODAL_STATE.resourceUpdating,
                    info: {
                        phase: res.phase,
                        progress: res.progress,
                        state: res.state
                    }
                });
            }
        };

        this.abortController = new AbortController();

        this.updaterState = UPDATE_MODAL_STATE.resourceUpdating;
        return this._resourceServer.update({
            signal: this.abortController.signal,
            callback: reportResourceUpdateState
        })
            .then(() => {
                this.reportUpdateState({phase: UPDATE_MODAL_STATE.resourceUpdatFinish});
                return Promise.resolve();
            })
            .catch(err => {
                if (!err.stack.startsWith('AbortError')) {
                    this.reportUpdateState({
                        phase: UPDATE_MODAL_STATE.error,
                        info: {
                            message: err.message
                        }
                    });
                }
                return Promise.reject(err);
            });

    }

    abortUpdate () {
        if (this.updaterState === UPDATE_MODAL_STATE.checkingResource ||
            this.updaterState === UPDATE_MODAL_STATE.resourceUpdating) {
            this.updaterState = UPDATE_MODAL_STATE.abort;
            this.abortController.abort();
        } else if (this.updaterState === UPDATE_MODAL_STATE.checkingApplication) {
            this.removeAllAutoUpdaterListeners();
        } else if (this.updaterState === UPDATE_MODAL_STATE.applicationDownloading) {
            this.removeAllAutoUpdaterListeners();
            this.cancellationToken.cancel();
            if (this.startDownloadTimeout) {
                clearTimeout(this.startDownloadTimeout);
            }
        }

        if (this.updaterState !== UPDATE_MODAL_STATE.abort) {
            this.updaterState = null;
        }
    }
}

export default OpenblockDesktopUpdater;
