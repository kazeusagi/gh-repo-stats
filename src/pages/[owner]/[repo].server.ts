import { defineHead } from 'void';

export const head = defineHead((c) => ({
  title: `${c.req.param('owner')}/${c.req.param('repo')}`,
}));
