#!/bin/bash

rm com.nike.nrc.room.database
adb pull /data/data/com.nike.plusgps/databases/com.nike.nrc.room.database .
rm -R gpx
node nrc2gpx.js
