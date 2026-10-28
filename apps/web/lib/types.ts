export type User={id:string;username:string;displayName:string;bio?:string;createdAt?:string;email?:string;postsCount?:number;followersCount?:number;followingCount?:number;isFollowing?:boolean};
export type Post={id:string;body:string;createdAt:string;author:User;likesCount:number;commentsCount:number;liked:boolean};
export type Comment={id:string;body:string;createdAt:string;author:User};
export type Notice={id:string;type:'like'|'comment'|'follow';postId:string|null;readAt:string|null;createdAt:string;actor:User};
export type Feed={items:Post[];page:number;hasMore:boolean};
