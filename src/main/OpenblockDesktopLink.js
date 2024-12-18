import {app} from 'electron';
import path from 'path';
import os from 'os';
import {execFile, spawn} from 'child_process';
import fs from 'fs-extra';

import sudo from 'sudo-prompt';
import {productName} from '../../package.json';

import OpenBlockLink from 'openblock-link';
import OpenblockResourceServer from 'openblock-resource';

class OpenblockDesktopLink {
    constructor () {
        this._resourceServer = null;

        this.appPath = app.getAppPath();
        if (this.appPath.search(/app/g) !== -1) {
            // Normal app
            this.appPath = path.join(this.appPath, '../../');
        } else if (this.appPath.search(/main/g) !== -1) { // eslint-disable-line no-negated-condition
            // Start by start script in debug mode.
            this.appPath = path.join(this.appPath, '../../');
        } else {
            // App in dir mode
            this.appPath = path.join(this.appPath, '../');
        }

        const userDataPath = app.getPath(
            'userData'
        );
        this.dataPath = path.join(userDataPath, 'Data');

        const cacheResourcesPath = path.join(this.dataPath, 'external-resources');
        if (!fs.existsSync(cacheResourcesPath)) {
            fs.mkdirSync(cacheResourcesPath, {recursive: true});
        }

        this._link = new OpenBlockLink(this.dataPath, path.join(this.appPath, 'tools'));
        this._resourceServer = new OpenblockResourceServer(cacheResourcesPath,
            path.join(this.appPath, 'external-resources'),
            app.getLocaleCountryCode());
    }

    get resourceServer () {
        return this._resourceServer;
    }

    installDriver (callback = null) {
        const driverPath = path.join(this.appPath, 'drivers');
        if ((os.platform() === 'win32') && (os.arch() === 'x64')) {
            execFile('install_x64.bat', [], {cwd: driverPath});
        } else if ((os.platform() === 'win32') && (os.arch() === 'ia32')) {
            execFile('install_x86.bat', [], {cwd: driverPath});
        } else if ((os.platform() === 'darwin')) {
            spawn('sh', ['install.sh'], {shell: true, cwd: driverPath});
        } else if ((os.platform() === 'linux')) {
            sudo.exec(`sh ${path.join(driverPath, 'linux_setup.sh')} yang`, {name: productName},
                error => {
                    if (error) throw error;
                    if (callback) {
                        callback();
                    }
                }
            );
        }
    }

    clearCache (reboot = true) {
        if (fs.existsSync(this.dataPath)) {
            fs.rmSync(this.dataPath, {recursive: true, force: true});
        }
        if (reboot){
            app.relaunch();
            app.exit();
        }
    }

    start () {
        this._link.listen();

        // start resource server
        this._resourceServer.listen();
    }
}

export default OpenblockDesktopLink;
