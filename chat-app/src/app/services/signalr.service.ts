import { Injectable, NgZone } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private hubConnection!: signalR.HubConnection;

  constructor(private zone: NgZone) {}

  private connectionStateSubject = new BehaviorSubject<string>('Disconnected');
  connectionState$ = this.connectionStateSubject.asObservable();

  private messagesSubject = new BehaviorSubject<{ user: string; message: string; time: string }[]>(
    []
  );
  private usersTypingSubject = new BehaviorSubject<string[]>([]);
  private joinedSubject = new BehaviorSubject<string | null>(null);
  private leftSubject = new BehaviorSubject<string | null>(null);

  messages$ = this.messagesSubject.asObservable();
  usersTyping$ = this.usersTypingSubject.asObservable();
  joined$ = this.joinedSubject.asObservable();
  left$ = this.leftSubject.asObservable();

  private messages: { user: string; message: string; time: string }[] = [];
  private typingUsers: Set<string> = new Set();

  get connectionState() {
    return this.hubConnection?.state ?? 'Disconnected';
  }

  connect(username: string) {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`https://localhost:7264/chatHub?username=${username}`)
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log('SignalR connected');
        this.zone.run(() => {
          this.connectionStateSubject.next('Connected');
        });
      })
      .catch((err) => {
        console.error('Error connecting to SignalR:', err);
        this.zone.run(() => {
          this.connectionStateSubject.next('Disconnected');
        });
      });

    this.hubConnection.onclose(() => {
      this.zone.run(() => {
        this.connectionStateSubject.next('Disconnected');
      });
    });

    // When a new message arrives
    this.hubConnection.on('ReceiveMessage', (user, message, time) => {
      this.messages.push({ user, message, time });
      this.messagesSubject.next(this.messages);
    });

    // When the user joins
    this.hubConnection.on('UserJoined', (user) => {
      this.joinedSubject.next(user);
    });

    // When the user leaves
    this.hubConnection.on('UserLeft', (user) => {
      this.leftSubject.next(user);
      this.typingUsers.delete(user);
      this.usersTypingSubject.next(Array.from(this.typingUsers));
    });

    // Typing indicator
    this.hubConnection.on('UserTyping', (user) => {
      this.typingUsers.add(user);
      this.usersTypingSubject.next(Array.from(this.typingUsers));
    });

    this.hubConnection.on('UserStoppedTyping', (user) => {
      this.typingUsers.delete(user);
      this.usersTypingSubject.next(Array.from(this.typingUsers));
    });
  }

  sendMessage(user: string, message: string) {
    this.hubConnection.invoke('SendMessage', user, message).catch((err) => console.error(err));
  }

  sendTyping(user: string, isTyping: boolean) {
    if (isTyping) this.hubConnection.invoke('Typing', user).catch((err) => console.error(err));
    else this.hubConnection.invoke('StopTyping', user).catch((err) => console.error(err));
  }

  leaveRoom() {
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.connectionStateSubject.next('Disconnected');
    }
  }
}
