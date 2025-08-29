export interface Repo {
  name: string;
  url: string;
  path: string;
  params?: { [key: string]: string };
}
