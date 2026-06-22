import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.redirect('/ui');
});

router.get('/ui', (_req, res) => {
  res.render('api-console', {
    title: 'Multitenant API Console',
    baseUrl: 'http://localhost:3000',
  });
});

export default router;
