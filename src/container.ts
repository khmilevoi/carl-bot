import 'reflect-metadata';

import { Container } from 'inversify';

import { register as registerApplication } from './container/application';
import { register as registerRepositories } from './container/repositories';
import { register as registerView } from './container/view';

export const container = new Container();

registerRepositories(container);
registerApplication(container);
registerView(container);
