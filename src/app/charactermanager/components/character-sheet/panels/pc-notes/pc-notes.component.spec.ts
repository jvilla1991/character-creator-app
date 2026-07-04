import { of, throwError } from 'rxjs';
import { SimpleChange } from '@angular/core';
import { PcNotesComponent } from './pc-notes.component';
import { PCService } from '../../../../services/pc.service';
import { PC } from '../../../../models/pc';
import { PcNote } from '../../../../models/pc-note';

describe('PcNotesComponent', () => {
  let pcService: jasmine.SpyObj<PCService>;
  let component: PcNotesComponent;

  const pc = (id: number): PC =>
    ({ id, name: 'X', clazz: 'Rogue', level: 2, playerName: 'P' } as PC);

  const note = (id: number, body: string, sessionId: number | null = null): PcNote =>
    ({ id, pcId: 1, body, createdAt: '2026-07-04T12:00:00Z', sessionId });

  beforeEach(() => {
    pcService = jasmine.createSpyObj<PCService>('PCService', ['getNotes', 'addNote']);
    component = new PcNotesComponent(pcService);
    component.canWrite = true;
  });

  function bind(newPc: PC, previous?: PC): void {
    component.pc = newPc;
    component.ngOnChanges({ pc: new SimpleChange(previous, newPc, previous == null) });
  }

  it('loads the notes when a character binds, newest first as served', () => {
    pcService.getNotes.and.returnValue(of([note(2, 'Later'), note(1, 'Earlier')]));

    bind(pc(1));

    expect(pcService.getNotes).toHaveBeenCalledWith(1);
    expect(component.notes.map(n => n.body)).toEqual(['Later', 'Earlier']);
  });

  it('does not reload for same-character change events, but does for a new character', () => {
    pcService.getNotes.and.returnValue(of([]));
    bind(pc(1));
    bind(pc(1), pc(1)); // live overlay refresh of the same PC
    expect(pcService.getNotes).toHaveBeenCalledTimes(1);

    bind(pc(2), pc(1));
    expect(pcService.getNotes).toHaveBeenCalledTimes(2);
  });

  it('adds a note (tagged with the live session) and prepends it', () => {
    pcService.getNotes.and.returnValue(of([note(1, 'Earlier')]));
    pcService.addNote.and.returnValue(of(note(2, 'We spared the chief', 9)));
    bind(pc(1));
    component.sessionId = 9;
    component.draft = '  We spared the chief  ';

    component.addNote();

    expect(pcService.addNote).toHaveBeenCalledWith(1, 'We spared the chief', 9);
    expect(component.notes[0].body).toBe('We spared the chief');
    expect(component.draft).toBe('');
  });

  it('keeps the draft and unblocks on a failed save; ignores blank drafts', () => {
    pcService.getNotes.and.returnValue(of([]));
    pcService.addNote.and.returnValue(throwError(() => new Error('403')));
    bind(pc(1));

    component.draft = '   ';
    component.addNote();
    expect(pcService.addNote).not.toHaveBeenCalled();

    component.draft = 'A clue';
    component.addNote();
    expect(component.draft).toBe('A clue'); // kept for retry
    expect(component.saving).toBeFalse();
  });
});
