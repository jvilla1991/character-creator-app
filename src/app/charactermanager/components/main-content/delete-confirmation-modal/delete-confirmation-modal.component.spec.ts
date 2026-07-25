import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal.component';
import { PC } from '../../../models/pc';

const STUB_PC: Partial<PC> = {
  id: 1, name: 'Aelindra', clazz: 'Wizard', level: 1, playerName: 'Alice',
};

describe('DeleteConfirmationModalComponent', () => {
  let component: DeleteConfirmationModalComponent;
  let fixture: ComponentFixture<DeleteConfirmationModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [DeleteConfirmationModalComponent],
}).compileComponents();

    fixture = TestBed.createComponent(DeleteConfirmationModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pc', STUB_PC as PC);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits confirm when confirmDelete is called', () => {
    let confirmed = false;
    component.confirm.subscribe(() => (confirmed = true));
    component.confirmDelete();
    expect(confirmed).toBeTrue();
  });

  it('emits close when cancel is called', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));
    component.cancel();
    expect(closed).toBeTrue();
  });

  it('exposes alertdialog semantics on the modal root', () => {
    const root: HTMLElement = fixture.nativeElement.querySelector('.modal');
    expect(root.getAttribute('role')).toBe('alertdialog');
    expect(root.getAttribute('aria-modal')).toBe('true');
    const titleId = root.getAttribute('aria-labelledby')!;
    const title = fixture.nativeElement.querySelector('#' + titleId);
    expect(title?.textContent).toContain('Strike From The Record');
  });
});
