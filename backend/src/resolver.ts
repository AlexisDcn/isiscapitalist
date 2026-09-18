import { origworld } from './origworld.js';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppService } from './app.service.js';
import { World, Product, Palier } from './graphql.js';

@Resolver('World')
export class GraphQlResolver {
  constructor(private service: AppService) {}

  @Query()
  async getWorld(@Args('user') user: string): Promise<World> {
    const world = this.service.readUserWorld(user);
    return world;
  }

  @Mutation()
  async acheterQtProduit(
    @Args('user') user: string,
    @Args('id') id: number,
    @Args('quantite') quantite: number,
  ): Promise<Product> {
    const world = this.service.readUserWorld(user);
    const product = this.service.achatProduit(world, id, quantite);
    this.service.saveWorld(user, world);
    return product;
  }

  @Mutation()
  async lancerProductionProduit(
    @Args('user') user: string,
    @Args('id') id: number,
  ): Promise<Product> {
    // a compléter
    return null as unknown as Product;
  }

  @Mutation()
  async engagerManager(
    @Args('user') user: string,
    @Args('name') name: string,
  ): Promise<Palier> {
    // a compléter
    return null as unknown as Palier;
  }

  @Mutation()
  async acheterCashUpgrade(
    @Args('user') user: string,
    @Args('name') name: string,
  ): Promise<Palier> {
    // a compléter
    return null as unknown as Palier;
  }

  @Mutation()
  async acheterAngelUpgrade(
    @Args('user') user: string,
    @Args('name') name: string,
  ): Promise<Palier> {
    // a compléter
    return null as unknown as Palier;
  }

  @Mutation()
  async resetWorld(@Args('user') user: string): Promise<World> {
    // a compléter
    return null as unknown as World;
  }
}
