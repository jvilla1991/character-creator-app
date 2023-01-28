import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';

@Component({
  selector: 'app-main-content',
  templateUrl: './main-content.component.html',
  styleUrls: ['./main-content.component.scss']
})
export class MainContentComponent implements OnInit {

  pc!: Observable<PC>;
  constructor(private route: ActivatedRoute,
    private service: PCService) { }

  ngOnInit(): void {
    this.route.params.subscribe(params =>
      { const id =  params['id'];
      this.pc = this.service.PCById(id);
      }
    );
  }
}
