//src/server.ts
import app from './app';
import { connectDB } from './config/db';
import { config } from './config/env';



const PORT = config.PORT;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      
      
      console.log(`Server running on port ${PORT}`);
      console.log(`Access backend at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};
startServer();