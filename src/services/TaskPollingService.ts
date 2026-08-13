import { getAccessToken } from '../store/firebase';
import { JobApplication, JobStage } from '../types';

export class TaskPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private lastPolledTime: string = new Date().toISOString();
  
  constructor(
    private applications: JobApplication[],
    private updateApplication: (id: string, updates: Partial<JobApplication>) => Promise<void>
  ) {}

  public updateDependencies(applications: JobApplication[]) {
    this.applications = applications;
  }

  public startPolling(intervalMs: number = 60000) {
    if (this.intervalId) return;
    
    // Initial fetch to get baseline
    this.lastPolledTime = new Date().toISOString();
    
    this.intervalId = setInterval(() => this.poll(), intervalMs);
    console.log('Task polling service started');
  }

  public stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Task polling service stopped');
    }
  }

  private async poll() {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!listsRes.ok) return;
      
      const listsData = await listsRes.json();
      const now = new Date().toISOString();
      
      for (const list of listsData.items || []) {
        const tasksRes = await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=true&showHidden=true&updatedMin=${this.lastPolledTime}`, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (!tasksRes.ok) continue;
        
        const tasksData = await tasksRes.json();
        const tasks = tasksData.items || [];
        
        for (const task of tasks) {
          if (task.status === 'completed' && task.title?.toLowerCase().includes('interview')) {
            // Find matching application
            const matchedApp = this.applications.find(app => 
              task.title.toLowerCase().includes(app.companyName.toLowerCase()) || 
              (task.notes && task.notes.toLowerCase().includes(app.companyName.toLowerCase()))
            );

            if (matchedApp) {
              const currentStage = matchedApp.stage;
              const skipStages: JobStage[] = ['Technical Loop', 'Onsite', 'Offer Extended', 'Archived'];
              
              if (!skipStages.includes(currentStage)) {
                console.log(`Auto-updating ${matchedApp.companyName} to Technical Loop based on task completion`);
                await this.updateApplication(matchedApp.id, { stage: 'Technical Loop' });
              }
            }
          }
        }
      }
      
      this.lastPolledTime = now;
    } catch (err) {
      console.error('Task poller error:', err);
    }
  }
}
