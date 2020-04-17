const childProcess = require('child_process');
const { mkdtempSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const usb = require('usb');
const drivelist = require('drivelist');

console.log('STDOUT [usb] start listening');

const TMP_PREFIX = 'uds_fuse';
const SOURCE_DIR = '/home/pi/Music/';
const DIR_NAMES_DESTINATION = ['Music'];

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

function findDestination(mountDir) {
  console.log(`STDOUT [destination] start finding`);
  const dirs = DIR_NAMES_DESTINATION;

  for(let dirI in dirs) {
    const dir = dirs[dirI];
    const output = childProcess.execSync(`find ${mountDir} -name "${dir}"`).toString();
    console.log(`STDOUT [destination] finding '${dir}' in '${mountDir}'`, output);
    const findedPath = output.split("\n")[0];
    if (!!findedPath) {
      console.log(`STDOUT [destination] finded '${dir}': ${findedPath}`);
      return findedPath;
    }
  }
  throw new Error('destination directory not found!');
}

function tryMTP(mountDir) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`STDOUT [mount mtp] device mount start`);
      const process = childProcess.execFile(`go-mtpfs`, [mountDir]);

      process.stdout.on('data', (data) => {
        lineByLine(data, (line) => {
          console.log(`STDOUT [gomtpfs]: ${line}`);
        });
      });

      process.stderr.on('data', (data) => {
        lineByLine(data, (line) => {
          console.log(`STDERR [gomtpfs]: ${line}`);
          if (line.includes('FUSE mounted')) {
            console.log(`STDOUT [mount mtp] device mount end`);
            resolve();
          }
          if (line.includes('no MTP devices found')) {
            console.log(`STDOUT [mount mtp] device mount fail, no MTP devices found`);
            reject();
          }
        });
      });

      process.on('exit', (code) => {
        console.log(`STDOUT [mount mtp] Exit go-mtpfs code: ${code}`);
      });
    });
  }, 2000);
}

function getDiskByDevice(device) {
  const disks = JSON.parse(childProcess.execSync(`lsblk ${device.devicePath} -o NAME --json`));
  return `/dev/${disks.blockdevices[0].children[0].name}`;
}

function tryMassStorage(mountDir) {
  return new Promise(async (resolve, reject) => {
    setTimeout(async () => {
      const drives = await drivelist.list();
      const drive = drives.filter(drive => !!drive.isUSB && !drive.isSystem)[0];

      if (!drive) {
        console.log(`STDOUT [mount sd] device mass storage not found`);
        reject();
        return;
      }

      try {
        console.log(`STDOUT [mount sd] device mount start`);
        childProcess.execSync(`sudo mount ${getDiskByDevice(drive)} ${mountDir}`);
        console.log(`STDOUT [mount sd] device mount end`);
        resolve();
      } catch(e) {
        console.log(`STDOUT [mount sd] device mount failed ${e}`);
        reject();
      }
    }, 2000);
  });
}

function sync(options, sourceDir, destination) {
  console.log(`STDOUT [rsync sd] start synchro`);
  const output = childProcess.execSync(`rsync ${options} ${sourceDir} ${destination}`);
  console.log(output.toString());
  console.log(`STDOUT [rsync sd] end synchro`);
}

function syncMTP(sourceDir, destination) {
  sync('-rvuprogress', sourceDir, destination);
}

function syncSD(sourceDir, destination) {
  sync('-rtvuprogress --no-o --no-g --no-p --no-t --modify-window=1', sourceDir, destination);
}

function tryUmount(mountDir) {
  console.log(`STDOUT [umount] start umount`);
  try {
    childProcess.execSync(`sudo umount ${mountDir}`);
    console.log(`STDOUT [umount] end umount`);
  } catch(e) {
    console.log(`STDOUT [umount] end umount (failed) ${e}`);
  }
}

module.exports = async () => {
  const mountDir = createTmpMountDir();
  console.log(`STDOUT [mount] mount tmp dir created (${mountDir})`);

  usb.on('attach', async (device) => {
    console.log('STDOUT [usbDetect] device connected', device);

    tryMassStorage(mountDir)
      .then(() => syncSD(SOURCE_DIR, findDestination(mountDir)))
      .catch((e) => {
        console.log(`STDERR [mount sd] failed`, e);
      })
      .finally(() => tryUmount(mountDir));

    tryMTP(mountDir)
      .then(() => syncMTP(SOURCE_DIR, findDestination(mountDir)))
      .catch((e) => {
        console.log(`STDERR [mount mtp] failed`, e);
      })
      .finally(() => tryUmount(mountDir));
  });

  usb.on('detach', (device) => {
    console.log('STDOUT [usbDetect] device disconnected', device);
  });
};
