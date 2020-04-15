const childProcess = require('child_process');
const { mkdtempSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const usbDetect = require('usb-detection');

usbDetect.startMonitoring();

const TMP_PREFIX = 'mtp_fuse';

function getDirNamePrefix() {
  const date = new Date();
  return `${TMP_PREFIX}_${date.getTime()}_`;
}

function createTmpMountDir() {
  const tmpPath = mkdtempSync(join(tmpdir(), getDirNamePrefix()));
  return tmpPath;
}

function lineByLine(data, cb) {
  return data.split('\n').forEach(cb);
}

function tryMTP(mountDir) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const process = childProcess.execFile(`go-mtpfs`, [mountDir]);

      process.stdout.on('data', (data) => {
        lineByLine(data, (line) => {
          console.log(`STDOUT [gomtpfs]: ${line}`);
        });
        setTimeout(() => resolve(), 1000);
      });

      process.stderr.on('data', (data) => {
        lineByLine(data, (line) => {
          console.log(`STDERR [gomtpfs]: ${line}`);
        });
        setTimeout(() => resolve(), 1000);
      });

      process.on('exit', (code) => {
        console.log(`EXIT go-mtpfs code: ${code}`);
      });
    });
  }, 2000);
}

module.exports = () => {
  const mountDir = createTmpMountDir();

  usbDetect.on('add', (device) => {
    console.log('STDOUT [usbDetect] device connected', device);
    tryMTP(mountDir)
      .then(() => {
        /*sync device*/
        console.log(`STDOUT [rsync] start synchro`);
      })
      .then(() => {
        console.log(`STDOUT [umount] start umount`);
        childProcess.execSync(`sudo umount ${mountDir}`);
        console.log(`STDOUT [umount] end umount`)
      });
  });

  usbDetect.on('remove', (device) => {
    console.log('STDOUT [usbDetect] device disconnected', device);
  });
};