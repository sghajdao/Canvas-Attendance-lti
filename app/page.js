export default function Home() {
  return (
    <div className="container">
      <div className="header">
        <h1>Canvas Attendance System</h1>
        <p>This app must be launched from Canvas</p>
      </div>
      
      <div className="user-info-card">
        <h2>Setup Complete</h2>
        <p>Launch this app from your Canvas course navigation to access the attendance system.</p>
        
        {/* Tailwind CSS Test */}
        <div className="mt-4 p-4 bg-blue-100 border border-blue-300 rounded-lg">
          <h3 className="text-blue-800 font-semibold">✅ Tailwind CSS is working!</h3>
          <p className="text-blue-600">This blue box confirms Tailwind CSS is properly configured.</p>
        </div>
      </div>
    </div>
  )
}