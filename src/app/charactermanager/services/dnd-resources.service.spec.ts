import { TestBed } from '@angular/core/testing';

import { DndResourcesService } from './dnd-resources.service';

describe('DndResourcesService', () => {
  let service: DndResourcesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DndResourcesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
