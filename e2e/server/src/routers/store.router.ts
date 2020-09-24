import { Router, OnInjection, route, Request, Response, validate } from '@singular/core';
import { should, could, that } from '@singular/validators';
import { pipe } from '@singular/pipes';
import { UsersService } from '@pit/service/users';
import { StoreService } from '@pit/service/store';
import { tokenProtected, ProtectedRequest } from '@pit/middleware/token-protected';
import { managerAccessProtected } from '@pit/middleware/manager-access-protected';
import { jsonBodyValidator } from '@pit/validator/json-body';
import { StoreItem, StoreItemType } from '@pit/model/item';
import { corsPolicy } from '@pit/cors/global';

@Router({
  name: 'store',
  routes: [
    route.get('/items', 'queryItems', [
      validate.queries({
        q: should.be.a.non.empty.string
      })
    ]),
    route.get('/item/:id', 'getItem', [
      validate.params({
        id: should.be.a.non.empty.string
      })
    ]),
    route.post('/item/:id/purchase', ['tokenProtected', 'purchaseItem'], [
      validate.queries({
        token: should.be.a.non.empty.string
      }),
      validate.params({
        id: should.be.a.string.with.length.equal(20)
      }),
      // Set body to item or reject if item not found
      validate.custom(async req => {

        try {

          req.body = await StoreService.getItem(req.params.id);

        }
        catch (error) {

          return error;

        }

        return true;

      }),
      // Validate item
      validate.body({
        stock: should.be.gt(0).otherwise('Item is out of stock!')
      })
    ]),
    // The following endpoints are all protected by manager access scope
    route.global('/', ['tokenProtected', 'managerAccessProtected'], [
      validate.queries({
        token: should.be.a.non.empty.string.otherwise('Missing token!')
      })
    ]),
    route.post('/item/new', 'newItem', [
      jsonBodyValidator,
      validate.body({
        type: should.belong.to.enum(StoreItemType),
        title: should.be.a.non.empty.string,
        artist: should.be.a.non.empty.string,
        releaseDate: should.be.a.date.number,
        tracks: should.be.an.array.with.children({
          title: that.is.a.non.empty.string,
          length: that.is.a.positive.number
        }).and.length.gt(0),
        price: should.be.a.positive.number,
        stock: should.be.a.number.gte(0)
      })
    ]),
    route.post('/item/:id/update', 'updateItem', [
      jsonBodyValidator,
      validate.params({
        id: should.be.a.non.empty.string
      }),
      validate.body({
        type: could.belong.to.enum(StoreItemType),
        title: could.be.a.non.empty.string,
        artist: could.be.a.non.empty.string,
        releaseDate: could.be.a.date.number,
        tracks: could.be.an.array.with.children({
          title: that.is.a.non.empty.string,
          length: that.is.a.positive.number
        }).and.length.gt(0),
        price: could.be.a.positive.number,
        stock: could.be.a.number.gte(0)
      }),
      // At least one property is provided
      validate.body(pipe.keys.then(
        should.includeAny('type', 'title', 'artist', 'releaseDate', 'tracks', 'price', 'stock')
        .otherwise('No data provided to update the item!')
      ))
    ]),
    route.delete('/item/:id', 'deleteItem', [
      validate.params({
        id: should.be.a.string.with.length.equal(20)
      })
    ])
  ],
  corsPolicy
})
export class StoreRouter implements OnInjection {

  public users: UsersService;
  public store: StoreService;

  onInjection({ users, store }) {

    this.users = users;
    this.store = store;

  }

  get tokenProtected() { return tokenProtected(this); }

  get managerAccessProtected() { return managerAccessProtected; }

  async queryItems(req: Request, res: Response) {

    await res.respond(await this.store.queryItems(<string>req.query.q));

  }

  getItem(req: Request, res: Response) {

    StoreService.getItem(req.params.id)
    .then(item => res.respond(item))
    .catch(error => res.respond(ServerError.from(error, error.httpCode || 400)));

  }

  purchaseItem(req: PurchaseRequest, res: Response) {

    this.store.updateItem(req.params.id, { stock: req.body.stock - 1 })
    .then(() => {

      log.id(req.session.id).info(`Purchased item ${req.body.title} for user ${req.user.username}`);

      res.respond({ message: `Purchased item ${req.body.title} for user ${req.user.username}` });

    })
    .catch(error => res.respond(ServerError.from(error)));

  }

  newItem(req: ProtectedRequest, res: Response) {

    this.store.newItem(req.body)
    .then(id => {

      log.id(req.session.id).info(`Manager "${req.user.username}" added a new item with ID "${id}".`);

      res.respond({ id });

    })
    .catch(error => res.respond(ServerError.from(error)));

  }

  updateItem(req: ProtectedRequest, res: Response) {

    this.store.updateItem(req.params.id, req.body)
    .then(() => {

      log.id(req.session.id).info(`Manager "${req.user.username}" updated item "${req.params.id}"`);

      res.respond({ message: `Item "${req.params.id}" was updated` });

    })
    .catch(error => res.respond(ServerError.from(error)));

  }

  deleteItem(req: ProtectedRequest, res: Response) {

    this.store.deleteItem(req.params.id)
    .then(() => {

      log.id(req.session.id).notice(`Manager "${req.user.username}" deleted item "${req.params.id}"`);

      res.respond({ message: `Item "${req.params.id}" was deleted` });

    })
    .catch(error => res.respond(ServerError.from(error)));

  }

}

interface PurchaseRequest extends ProtectedRequest {

  body: StoreItem;

}
