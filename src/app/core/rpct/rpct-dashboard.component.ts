import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { CompanyService } from '../company/company.service';
import { ResultService } from '../result/result.service';
import { Company } from '../company/company.model';
import { Workflow, Status } from '../conductor/workflow.model';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';

interface RpctTableRow {
  codiceIpa: string;
  denominazioneEnte: string;
  lastScanDate: Date | null;
  status: Status | null;
  badge: string;
  sezioniOk: number;
  sezioniNonRegolari: number;
  workflowId: string | null;
}

@Component({
  selector: 'app-rpct-dashboard',
  templateUrl: './rpct-dashboard.component.html',
  standalone: false
})
export class RpctDashboardComponent implements OnInit {

  rows: RpctTableRow[] = [];
  userName: string = '';
  isLoading = true;

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private companyService: CompanyService,
    private resultService: ResultService,
    private authGuard: AuthGuard,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authGuard.isDevAuthBypassEnabled()) {
      this.loadData(this.authGuard.getDevBypassUserData());
      return;
    }
    if (!environment.oidc.enable) {
      this.isLoading = false;
      return;
    }

    // Aspetta userData con rpct_ipas popolato, prende solo la prima emissione valida
    this.oidcSecurityService.userData$.pipe(
      filter(({ userData }) => !!userData?.rpct_ipas?.length),
      take(1)
    ).subscribe(({ userData }) => {
      this.loadData(userData);
    });
  }

  private loadData(userData: any): void {
    this.userName = userData?.name || '';
    const ipas: string[] = userData?.rpct_ipas || [];

    if (ipas.length === 0) {
      this.isLoading = false;
      return;
    }

    this.rows = ipas.map(ipa => ({
      codiceIpa: ipa,
      denominazioneEnte: ipa,
      lastScanDate: null,
      status: null,
      badge: 'secondary',
      sezioniOk: 0,
      sezioniNonRegolari: 0,
      workflowId: null
    }));

    const requests = ipas.map(ipa =>
      forkJoin({
        companies: this.companyService.getAll({ codiceIpa: ipa, size: 1 }).pipe(catchError(() => of([]))),
        workflow: this.resultService.lastWorflowCompleted(ipa, false).pipe(catchError(() => of(null)))
      })
    );

    forkJoin(requests).pipe(
      switchMap(results => {
        results.forEach((res, i) => {
          const company: Company = res.companies?.[0];
          const workflow: Workflow | null = res.workflow;
          if (company) this.rows[i].denominazioneEnte = company.denominazioneEnte;
          if (workflow) {
            this.rows[i].workflowId = workflow.workflowId;
            this.rows[i].lastScanDate = workflow.startTime;
            this.rows[i].status = workflow.status;
            this.rows[i].badge = workflow.badge;
          }
        });

        const workflowIds = this.rows
          .map(r => r.workflowId)
          .filter((id): id is string => !!id);

        if (workflowIds.length === 0) return of(null);
        return this.resultService.getWorkflowMap(undefined, workflowIds).pipe(catchError(() => of(null)));
      })
    ).subscribe(workflowMap => {
      if (workflowMap) {
        this.rows.forEach(row => {
          if (!row.workflowId) return;
          const counts = workflowMap[row.workflowId] || {};
          row.sezioniOk = (counts[200] || 0) + (counts[202] || 0);
          row.sezioniNonRegolari = (counts[404] || 0) + (counts[400] || 0) + (counts[500] || 0);
        });
      }
      this.isLoading = false;
    });
  }

  goToDetail(codiceIpa: string): void {
    this.router.navigate(['/dashboard', codiceIpa]);
  }
}
