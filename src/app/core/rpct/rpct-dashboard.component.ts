import { Component, OnInit } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';

@Component({
  selector: 'app-rpct-dashboard',
  templateUrl: './rpct-dashboard.component.html',
  standalone: false
})
export class RpctDashboardComponent implements OnInit {

  rpctIpas: string[] = [];
  userName: string = '';

  constructor(private oidcSecurityService: OidcSecurityService) {}

  ngOnInit(): void {
    this.oidcSecurityService.userData$.subscribe(({ userData }) => {
      this.rpctIpas = userData?.rpct_ipas || [];
      this.userName = userData?.name || '';
    });
  }
}
