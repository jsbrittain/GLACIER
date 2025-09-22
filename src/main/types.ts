export interface IRepo {
  id: string;
  name: string;
  url: string;
  path: string;
  version: string;
  params?: { [key: string]: string };
}
