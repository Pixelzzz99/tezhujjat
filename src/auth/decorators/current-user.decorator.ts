import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type CurrentUserShape = { id: string; email: string };

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserShape | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserShape | undefined;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
