/*
Logger class for easy and aesthetically pleasing console logging
by anIdiotsGuide
*/
const chalk = require('chalk');
const { Timestamp } = require("@sapphire/time-utilities");

exports.log = (content, type = "log") => {
  const timestamp = `[${chalk.blueBright(new Timestamp("YYYY-MM-DD HH:mm:ss"))}]:`;
  
  switch (type) {
    case "log": return console.log(`${timestamp} ${chalk.bgWhite(type.toUpperCase())} ${content} `);
    case "warn": return console.log(`${timestamp} ${chalk.bgYellow(type.toUpperCase())} ${content} `);
    case "error": return console.log(`${timestamp} ${chalk.bgRed(type.toUpperCase())} ${content} `);
    case "debug": return console.log(`${timestamp} ${chalk.bgMagenta(type.toUpperCase())} ${content} `);
    case "cmd": return console.log(`${timestamp} ${chalk.bgWhite(type.toUpperCase())} ${content}`);
    case "ready": return console.log(`${timestamp} ${chalk.bgGreen(type.toUpperCase())} ${content}`);
    case "cache": return console.log(`${chalk.cyan(type.toUpperCase())} ${timestamp} ${content}`);
    default: throw new TypeError("Logger type must be either warn, debug, log, ready, cmd or error.");
  }
}; 

exports.error = (...args) => this.log(...args, "error");

exports.warn = (...args) => this.log(...args, "warn");

exports.debug = (...args) => this.log(...args, "debug");

exports.cmd = (...args) => this.log(...args, "cmd");

exports.ready = (...args) => this.log(...args, "ready");

exports.cache = (...args) => this.log(...args, "cache");