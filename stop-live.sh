#!/bin/bash

PROJECT_FOLDER=/var/www/singingbank.com/live/SingingBank
LOG_DIR=/var/log/singingbank.com/live
LOG_FILE=$LOG_DIR/singingbank-live.log
PID_FILE=/var/run/nodejs-singingbank-live.pid

/usr/local/bin/forever --pidFile $PID_FILE stop $PROJECT_FOLDER/app.js
echo "Stopping NodeJS app"
echo "Stopping NodeJS app" >> $LOG_FILE
exit 0
