import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { AuthService } from '../service/auth.service';
import { AuthGuard } from '../auth.guard';
import { SanitizationPipe } from 'src/pipes/sanization.pipe';

@ApiTags('Auth')
@UsePipes(SanitizationPipe)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary:
      'Register a new user (Admin or Client, if none selected Client by default)',
  })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login and get JWT token' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @UseGuards(AuthGuard)
  @Get('logged-user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the logged user info (JWT required)' })
  @ApiResponse({ status: 200, description: 'User data returned successfully' })
  async loggedUser(@Request() request) {
    return request.user;
  }
}
