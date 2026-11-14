import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackgroundStoryComponent } from './background-story.component';
import { PC } from '../../../../models/pc';

describe('BackgroundStoryComponent', () => {
  let fixture: ComponentFixture<BackgroundStoryComponent>;

  const pc = (overrides: Partial<PC> = {}): PC =>
    ({ name: 'Vex', background: 'Acolyte', alignment: 'Neutral Good', ...overrides }) as PC;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackgroundStoryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BackgroundStoryComponent);
  });

  /** The eyebrow label of the notes block, or null when the block is absent. */
  function notesLabel(): string | null {
    const labels: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.eyebrow'));
    const notes = labels.find(l => /notes/i.test(l.textContent ?? ''));
    return notes ? notes.textContent!.trim() : null;
  }

  // PC.notes is the player's own narrative field: the backend files it under
  // Narrative beside `bio` and hides it from the DM's member projection. The
  // sheet had labelled it "DM Notes" since 2026-05-30, telling a player their
  // own notes were the DM's.
  it("labels the player's notes as their own, not as DM notes", () => {
    fixture.componentRef.setInput('pc', pc({ notes: 'Owes the Crimson Lantern 60gp.' }));
    fixture.detectChanges();

    expect(notesLabel()).toBe('Notes');
    expect(fixture.nativeElement.textContent).toContain('Owes the Crimson Lantern 60gp.');
    expect(fixture.nativeElement.textContent).not.toContain('DM Notes');
  });

  it('omits the notes block when the character has none', () => {
    fixture.componentRef.setInput('pc', pc({ notes: '' }));
    fixture.detectChanges();

    expect(notesLabel()).toBeNull();
  });
});
