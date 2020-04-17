This tool is sandbox.
I use this for recognize methods for headless synchronization music players :) 

Types of devices:
 - USB mass storage
 - Media Transfor Protocol

Requirements
 - go-mtpfs `sudo apt-get install go-mtpfs`
 - rsync `sudo apt-get install rsync`
 - libudev `sudo apt-get install libudev-dev`

How it works

MTP
```
mkdir /tmp/mount-directory
go-mtpfs /tmp/mount-directory

rsync -nrvuprogress /home/pi/Music/ /tmp/test-j/SD\ card/ # dry-run
rsync -nrvuprogress /home/pi/Music/ /tmp/test-j/SD\ card/

sudo umount /tmp/test-j

find /tmp/test -name "Music"
```