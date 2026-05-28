#!/usr/bin/env node
/**
 * @plys/libraries/notifications re-exports platform-service source in dev.
 * For Docker runtime, emit a CJS barrel that points at compiled platform-service output.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'packages/dist/notifications');
const platformBase =
  'apps/platform-service/dist/apps/platform-service/src/modules/notifications';

const rel = (suffix) =>
  path.relative(outDir, path.join(root, platformBase, suffix)).replace(/\\/g, '/');

const indexPath = path.join(outDir, 'index.js');
const relEnum = rel('enums/notification-type.enum.js');
const relModule = rel('notifications.module.js');
const relDispatchModule = rel('notifications-dispatch.module.js');
const relDispatcher = rel('services/notification-dispatcher.service.js');

for (const target of [
  path.join(root, platformBase, 'enums/notification-type.enum.js'),
  path.join(root, platformBase, 'notifications.module.js'),
  path.join(root, platformBase, 'notifications-dispatch.module.js'),
  path.join(root, platformBase, 'services/notification-dispatcher.service.js'),
]) {
  if (!fs.existsSync(target)) {
    console.error(`ERROR: platform-service notifications build output missing: ${target}`);
    console.error('Run nx build for platform-service before this script.');
    process.exit(1);
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  indexPath,
  `'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.NotificationsDispatchModule = exports.NotificationsModule = exports.NotificationDispatcherService = exports.NOTIFICATION_TYPES = void 0;
exports.NOTIFICATION_TYPES = require('${relEnum}').NOTIFICATION_TYPES;
exports.NotificationsModule = require('${relModule}').NotificationsModule;
exports.NotificationsDispatchModule = require('${relDispatchModule}').NotificationsDispatchModule;
exports.NotificationDispatcherService = require('${relDispatcher}').NotificationDispatcherService;
`,
);

console.log(`Wrote ${path.relative(root, indexPath)}`);
