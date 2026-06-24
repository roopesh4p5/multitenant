import { Router } from 'express';

const router = Router();


// i needed some kind of UI 
// came across this ejs api console, so added it here for now

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
