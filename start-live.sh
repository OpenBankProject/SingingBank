#!/bin/bash

PROJECT_FOLDER=/var/www/singingbank.com/live/SingingBank/
LOG_DIR=/var/log/singingbank.com/live
LOG_FILE=$LOG_DIR/singingbank-live.log
ERROR_LOG_FILE=$LOG_DIR/singingbank-live-error.log

USER=www-data
GROUP=www-data

NODE_ENV=production

PID_FILE=/var/run/nodejs-singingbank-live.pid

if [ -a $LOG_FILE ]
  then
    mv  $LOG_FILE $LOG_FILE-`date +%F_%k:%M`
    touch $LOG_FILE
  else
    touch $LOG_FILE
fi

chown -R $USER:$GROUP $LOG_DIR 
chown $USER:$GROUP $LOG_FILE 
NODE_ENV=$NODE_ENV /usr/local/bin/forever --pidFile $PID_FILE -a -l $LOG_FILE -e $ERROR_LOG_FILE start $PROJECT_FOLDER/app.js
echo -n "PID:`cat $PID_FILE| tr -d \"\n\"`"
echo
