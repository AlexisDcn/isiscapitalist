import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppService } from './app.service.js';
import { World, Product, Palier } from './graphql.js';

@Resolver('World')
export class GraphQlResolver {
  constructor(private service: AppService) {}

  @Query()
  async getWorld(@Args('user') user: string): Promise<World> {
    const world = this.service.readUserWorld(user);
    this.service.saveWorld(user, world);
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
    const world = this.service.readUserWorld(user);
    const product = this.service.lancerProduction(world, id);
    this.service.saveWorld(user, world);
    return product;
  }

  @Mutation()
  async engagerManager(
    @Args('user') user: string,
    @Args('name') name: string,
  ): Promise<Palier> {
    const world = this.service.readUserWorld(user);
    const manager = this.service.engagerManager(world, name);
    this.service.saveWorld(user, world);
    return manager;
  }

  @Mutation()
  async acheterCashUpgrade(
    @Args('user') user: string,
    @Args('name') name: string,
  ): Promise<Palier> {
    const world = this.service.readUserWorld(user);
    const upgrade = this.service.acheterCashUpgrade(world, name);
    this.service.saveWorld(user, world);
    return upgrade;
  }

  @Mutation()
  async acheterAngelUpgrade(
    @Args('user') user: string,
    @Args('name') name: string,
  ): Promise<Palier> {
    const world = this.service.readUserWorld(user);
    const upgrade = this.service.acheterAngelUpgrade(world, name);
    this.service.saveWorld(user, world);
    return upgrade;
  }

  @Mutation()
  async resetWorld(@Args('user') user: string): Promise<World> {
    // a compléter
    return null as unknown as World;
  }
}
