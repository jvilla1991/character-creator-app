// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { NgModule, provideZoneChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// Angular 21 defaults TestBed to zoneless change detection. The app still
// bootstraps with zone-based change detection (see main.ts), so mirror that
// here to keep test semantics aligned with runtime behavior.
@NgModule({ providers: [provideZoneChangeDetection()] })
class ZoneChangeDetectionTestModule {}

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  [BrowserDynamicTestingModule, ZoneChangeDetectionTestModule],
  platformBrowserDynamicTesting(),
);
