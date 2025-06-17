
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function UseCaseDiagramGenerator() {
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('ICHI Application - Use Case Diagram', 105, 20, { align: 'center' });
    
    // Actors
    doc.setFontSize(12);
    doc.text('Actors:', 20, 40);
    doc.setFontSize(10);
    doc.text('• User (Пользователь)', 25, 50);
    doc.text('• System (Система)', 25, 60);
    doc.text('• Contact (Контакт)', 25, 70);
    
    // Use Cases
    doc.setFontSize(12);
    doc.text('Use Cases:', 20, 90);
    doc.setFontSize(10);
    
    // Authentication
    doc.text('1. Authentication & Profile Management', 25, 105);
    doc.text('   • Login/Logout', 30, 115);
    doc.text('   • View/Edit Profile', 30, 125);
    doc.text('   • Manage Account Settings', 30, 135);
    
    // Task Management
    doc.text('2. Task Management', 25, 150);
    doc.text('   • Create Task', 30, 160);
    doc.text('   • Edit Task', 30, 170);
    doc.text('   • Delete Task', 30, 180);
    doc.text('   • Assign Task to User', 30, 190);
    doc.text('   • Add/Remove Collaborators', 30, 200);
    doc.text('   • View Task Details', 30, 210);
    doc.text('   • Upload Media to Task', 30, 220);
    doc.text('   • Change Task Status', 30, 230);
    
    // Mind Map
    doc.text('3. Mind Map Visualization', 25, 245);
    doc.text('   • View Mind Map', 30, 255);
    doc.text('   • Navigate Task Hierarchy', 30, 265);
    doc.text('   • Drag and Position Tasks', 30, 275);
    
    // New page for more use cases
    doc.addPage();
    
    // Communication
    doc.setFontSize(12);
    doc.text('4. Communication', 25, 20);
    doc.setFontSize(10);
    doc.text('   • Send/Receive Messages', 30, 30);
    doc.text('   • Make Voice/Video Calls', 30, 40);
    doc.text('   • Manage Contacts', 30, 50);
    doc.text('   • Search for Users', 30, 60);
    doc.text('   • Add Contacts', 30, 70);
    
    // Email
    doc.setFontSize(12);
    doc.text('5. Email Management', 25, 85);
    doc.setFontSize(10);
    doc.text('   • View Inbox', 30, 95);
    doc.text('   • Compose Email', 30, 105);
    doc.text('   • Organize Email Folders', 30, 115);
    doc.text('   • Search Emails', 30, 125);
    
    // Notifications
    doc.setFontSize(12);
    doc.text('6. Notification System', 25, 140);
    doc.setFontSize(10);
    doc.text('   • Receive Task Assignment Notifications', 30, 150);
    doc.text('   • Receive Collaborator Notifications', 30, 160);
    doc.text('   • Mark Notifications as Read', 30, 170);
    doc.text('   • View Notification History', 30, 180);
    
    // Search
    doc.setFontSize(12);
    doc.text('7. Global Search', 25, 195);
    doc.setFontSize(10);
    doc.text('   • Search Pages', 30, 205);
    doc.text('   • Search Contacts', 30, 215);
    doc.text('   • Navigate to Search Results', 30, 225);
    
    // Relaxation
    doc.setFontSize(12);
    doc.text('8. Relaxation Mode', 25, 240);
    doc.setFontSize(10);
    doc.text('   • Enter Relaxation Mode', 30, 250);
    doc.text('   • View Calming Interface', 30, 260);
    
    // New page for relationships
    doc.addPage();
    
    // Relationships
    doc.setFontSize(16);
    doc.text('Actor-Use Case Relationships', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('User can:', 25, 40);
    doc.setFontSize(10);
    doc.text('• Login/Logout to system', 30, 50);
    doc.text('• Create, edit, delete own tasks', 30, 60);
    doc.text('• Assign tasks to contacts', 30, 70);
    doc.text('• Add collaborators to tasks', 30, 80);
    doc.text('• Send/receive messages', 30, 90);
    doc.text('• Make voice/video calls', 30, 100);
    doc.text('• Manage email', 30, 110);
    doc.text('• Search globally', 30, 120);
    doc.text('• View notifications', 30, 130);
    doc.text('• Use relaxation mode', 30, 140);
    doc.text('• View and navigate mind map', 30, 150);
    
    doc.setFontSize(12);
    doc.text('System automatically:', 25, 170);
    doc.setFontSize(10);
    doc.text('• Sends notifications on task assignment', 30, 180);
    doc.text('• Updates real-time data', 30, 190);
    doc.text('• Manages user authentication', 30, 200);
    doc.text('• Stores and retrieves data', 30, 210);
    
    doc.setFontSize(12);
    doc.text('Contact can:', 25, 230);
    doc.setFontSize(10);
    doc.text('• Receive task assignments', 30, 240);
    doc.text('• Be added as collaborator', 30, 250);
    doc.text('• Receive and send messages', 30, 260);
    
    // Save PDF
    doc.save('ICHI-UseCase-Diagram.pdf');
  };

  return (
    <Button onClick={generatePDF} className="flex items-center gap-2">
      <Download className="h-4 w-4" />
      Скачать Use-Case диаграмму PDF
    </Button>
  );
}
