// import { NextResponse } from 'next/server';
// import { initDatabase } from '@/lib/db';

// export async function GET() {
//   try {
//     await initDatabase();
//     return NextResponse.json({ 
//       success: true, 
//       message: 'Database initialized successfully' 
//     });
//   } catch (error) {
//     return NextResponse.json(
//       { 
//         success: false, 
//         error: error.message 
//       },
//       { status: 500 }
//     );
//   }
// }