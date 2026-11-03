import { Component } from '@angular/core';
import { Translated } from './shared';

@Component({
  selector: 'footer[app-page-footer]',
  templateUrl: './page-footer.html',
  host: { class: 'page-footer' },
})
export class PageFooter extends Translated {}
