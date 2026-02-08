import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" (click)="cancelEmit()">
      <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="p-5 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
          <h2 class="text-base font-mono font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            CONFIRM ACTION
          </h2>
        </div>

        <!-- Body -->
        <div class="p-6 text-slate-300 text-sm font-sans space-y-4">
          <p class="font-bold text-white text-lg">{{ title() }}</p>
          <p class="leading-relaxed opacity-90">{{ message() }}</p>
          
          <div class="bg-slate-800/50 p-3 rounded border border-slate-700/50 mt-4">
             <p class="text-[10px] text-slate-500 font-mono uppercase mb-1">System Note</p>
             <p class="text-xs text-orange-300 font-mono flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               This operation modifies the knowledge base.
             </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
          <button (click)="cancelEmit()" 
            class="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white transition-colors uppercase font-bold tracking-wider">
            Cancel
          </button>
          <button (click)="confirmEmit()" 
            class="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg text-xs font-mono transition-colors flex items-center gap-2 uppercase tracking-wider">
            Proceed
          </button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmationModalComponent {
  title = input.required<string>();
  message = input.required<string>();
  
  confirm = output<void>();
  cancel = output<void>();

  confirmEmit() { this.confirm.emit(); }
  cancelEmit() { this.cancel.emit(); }
}