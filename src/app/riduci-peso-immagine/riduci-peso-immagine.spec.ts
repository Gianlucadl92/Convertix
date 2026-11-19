import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RiduciPesoImmagine } from './riduci-peso-immagine';

describe('RiduciPesoImmagine', () => {
  let component: RiduciPesoImmagine;
  let fixture: ComponentFixture<RiduciPesoImmagine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiduciPesoImmagine],
    }).compileComponents();

    fixture = TestBed.createComponent(RiduciPesoImmagine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
