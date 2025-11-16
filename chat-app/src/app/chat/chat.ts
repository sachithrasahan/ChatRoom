import { Component, ChangeDetectorRef, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { SignalRService } from '../services/signalr.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss'],
})
export class Chat implements OnInit, OnDestroy, AfterViewChecked {
  username = '';
  tempName = '';
  message = '';
  messages: { user: string; message: string; time: string }[] = [];
  typingUsers: string[] = [];
  private typingTimeout: any;

  constructor(public signalR: SignalRService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Receive live messages
    this.signalR.messages$.subscribe((m) => {
      this.messages = m;
      this.cdr.markForCheck();
    });

    // Receive typing users list
    this.signalR.usersTyping$.subscribe((u) => {
      this.typingUsers = u;
      this.cdr.markForCheck();
    });

    // User joined
    this.signalR.joined$.subscribe((u) => {
      if (u && u !== this.username) {
        // Prevent duplicates (same "joined" line twice)
        const alreadyExists = this.messages.some(
          (msg) => msg.user === 'System' && msg.message === `${u} joined the chat.`
        );
        if (!alreadyExists) {
          this.messages.push({
            user: 'System',
            message: `${u} joined the chat.`,
            time: new Date().toISOString(),
          });
          this.cdr.markForCheck();
        }
      }
    });

    // User left
    this.signalR.left$.subscribe((u) => {
      if (u) {
        const alreadyExists = this.messages.some(
          (msg) => msg.user === 'System' && msg.message === `${u} left the chat.`
        );
        if (!alreadyExists) {
          this.messages.push({
            user: 'System',
            message: `${u} left the chat.`,
            time: new Date().toISOString(),
          });
          this.cdr.markForCheck();
        }
      }
    });
  }

  ngAfterViewChecked() {
    // Always scroll chat to bottom on update
    const box = document.getElementById('chat-box');
    if (box) box.scrollTop = box.scrollHeight;
  }

  join() {
    if (this.tempName.trim()) {
      this.username = this.tempName.trim();
      this.signalR.connect(this.username);
    }
  }

  leave() {
    this.signalR.leaveRoom();
    this.username = '';
    this.messages = []; // clear local messages
    this.typingUsers = [];
    this.cdr.markForCheck();
  }

  send() {
    if (!this.message.trim()) return;

    this.signalR.sendMessage(this.username, this.message);
    this.message = '';

    // Stop typing indicator after sending message
    this.signalR.sendTyping(this.username, false);
    this.cdr.markForCheck();
  }

  onEnterPress(event: any) {
    if (!event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  onTypingStart() {
    if (!this.username) return;

    clearTimeout(this.typingTimeout);
    this.signalR.sendTyping(this.username, true);

    // Stop typing after 2 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      this.signalR.sendTyping(this.username, false);
    }, 2000);
  }

  onTypingStop() {
    if (this.username) {
      this.signalR.sendTyping(this.username, false);
    }
  }

  ngOnDestroy() {
    this.signalR.leaveRoom();
  }
}
