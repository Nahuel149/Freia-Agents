import { init, getDataSource } from './DataSource';
import { User } from './oss/database/entities/user.entity';
import { compareHash } from './oss/utils/encryption.util';

async function queryCredential() {
  await init();
  const AppDataSource = getDataSource();
  try {
    await AppDataSource.initialize();
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email: 'admin@freia.ai' } });
    if (user && user.credential) {
      console.log('Current credential:', user.credential);
      const isValid = await compareHash('Testing123!', user.credential);
      console.log('Password "Testing123!" matches stored hash:', isValid);
    } else {
      console.log('No user or credential found');
    }
  } catch (err) {
    console.error('Error querying credential:', err);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

queryCredential();