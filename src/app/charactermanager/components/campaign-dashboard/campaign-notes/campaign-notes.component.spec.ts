import { of, throwError } from 'rxjs';
import { CampaignNotesComponent } from './campaign-notes.component';
import { Campaign } from '../../../models/campaign';
import { SessionNote } from '../../../models/session-note';

/** Tests the component class directly (no TestBed/DOM), per the app convention. */
describe('CampaignNotesComponent', () => {
  let component: CampaignNotesComponent;
  let campaignService: any;

  const campaign = { id: '1', name: 'The Veiled Compass' } as unknown as Campaign;
  const note: SessionNote = {
    id: 7, body: 'The cult struck back.', createdAt: '2026-07-01T00:00:00.000Z', sessionId: null,
  };

  beforeEach(() => {
    campaignService = jasmine.createSpyObj('CampaignService',
      ['getNotes', 'addNote', 'updateNote', 'deleteNote']);
    campaignService.getNotes.and.returnValue(of([note]));
    component = new CampaignNotesComponent(campaignService);
    component.campaign = campaign;
    component.ngOnChanges({ campaign: {} as any });
  });

  it('loads notes when the campaign changes', () => {
    expect(campaignService.getNotes).toHaveBeenCalledWith('1');
    expect(component.notes).toEqual([note]);
  });

  it('startEdit opens the inline editor seeded with the note body', () => {
    component.startEdit(note);
    expect(component.editingId).toBe(7);
    expect(component.editDraft).toBe('The cult struck back.');
  });

  it('saveEdit sends the trimmed body and swaps in the returned note', () => {
    const updated: SessionNote = { ...note, body: 'The cult regrouped.',
      updatedAt: '2026-07-02T00:00:00.000Z' };
    campaignService.updateNote.and.returnValue(of(updated));
    component.startEdit(note);
    component.editDraft = '  The cult regrouped.  ';

    component.saveEdit(note);

    expect(campaignService.updateNote).toHaveBeenCalledWith('1', 7, 'The cult regrouped.');
    expect(component.notes[0]).toBe(updated);
    expect(component.editingId).toBeNull(); // editor closed
  });

  it('saveEdit ignores a blank draft', () => {
    component.startEdit(note);
    component.editDraft = '   ';
    component.saveEdit(note);
    expect(campaignService.updateNote).not.toHaveBeenCalled();
  });

  it('saveEdit keeps the editor open on failure', () => {
    campaignService.updateNote.and.returnValue(throwError(() => new Error('boom')));
    component.startEdit(note);
    component.editDraft = 'New text';
    component.saveEdit(note);
    expect(component.editingId).toBe(7);
    expect(component.saving).toBeFalse();
  });

  it('cancelEdit closes the editor without saving', () => {
    component.startEdit(note);
    component.cancelEdit();
    expect(component.editingId).toBeNull();
    expect(campaignService.updateNote).not.toHaveBeenCalled();
  });
});
