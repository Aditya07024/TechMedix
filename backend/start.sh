#!/bin/bash
ulimit -n 4096
mkdir -p uploads
npm install
node app.js