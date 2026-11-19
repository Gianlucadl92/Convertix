import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConvertiFile } from './converti-file';

describe('ConvertiFile', () => {
  let component: ConvertiFile;
  let fixture: ComponentFixture<ConvertiFile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConvertiFile],
    }).compileComponents();

    fixture = TestBed.createComponent(ConvertiFile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
