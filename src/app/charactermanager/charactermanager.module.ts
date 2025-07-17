import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule, Router } from '@angular/router';

import { CharactermanagerAppComponent } from './charactermanager-app.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { MainContentComponent } from './components/main-content/main-content.component';
import { SidenavComponent } from './components/sidenav/sidenav.component';

import { MaterialModule } from '../shared/material.module';
import { FlexLayoutModule } from '@angular/flex-layout';
import { HttpClientModule } from '@angular/common/http';
import { PCService } from './services/pc.service';
import { AuthService } from './services/auth.service';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { DeleteConfirmationModalComponent } from './components/main-content/delete-confirmation-modal/delete-confirmation-modal.component';


const routes: Routes = [
  {
    path: '', component: CharactermanagerAppComponent,
    children: [
      { path: ':id', component: MainContentComponent },
      { path: '', component: MainContentComponent },
      { path: 'create', component: MainContentComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  declarations: [
    CharactermanagerAppComponent,
    ToolbarComponent,
    MainContentComponent,
    SidenavComponent,
    DeleteConfirmationModalComponent,
  ],
  imports: [
    CommonModule,
    MaterialModule,
    HttpClientModule,
    FlexLayoutModule,
    FormsModule,
    MatDialogModule,
    RouterModule.forChild(routes)
  ],
  providers: [
    PCService,
    AuthService
  ]
})
export class CharactermanagerModule { }
