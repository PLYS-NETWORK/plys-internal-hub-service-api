import { AbstractRepository } from '@common/repositories';
import { Order } from '@common/dto/page-options.dto';
import { Project } from '@database/entities';

export interface IProjectRepository extends AbstractRepository<Project> {
  findByBusinessId(
    businessId: string,
    skip: number,
    take: number,
    keywords?: string,
    sortBy?: string,
    orderBy?: Order,
  ): Promise<[Project[], number]>;
  findByIdAndBusinessId(id: string, businessId: string): Promise<Project | null>;
  findPublicMatchingSkills(
    skillIds: string[],
    skip: number,
    take: number,
  ): Promise<[Project[], number]>;
}
