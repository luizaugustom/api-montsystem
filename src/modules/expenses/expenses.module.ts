import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CompanyModule } from '../company/company.module';

import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { RecurringExpense } from './entities/recurring-expense.entity';
import { ExpenseReminder } from './entities/expense-reminder.entity';

import { ExpensesRepository } from './expenses.repository';
import { ExpenseCategoriesRepository } from './expense-categories.repository';
import { RecurringExpensesRepository } from './recurring-expenses.repository';
import { ExpenseRemindersRepository } from './expense-reminders.repository';

import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesService } from './expense-categories.service';
import { RecurringExpensesService } from './recurring-expenses.service';

import { ExpensesController } from './expenses.controller';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { ExpenseCategoriesController } from './expense-categories.controller';

import { ExpensesListener } from './expenses.listener';
import { ExpensesCron } from './expenses.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, ExpenseCategory, RecurringExpense, ExpenseReminder]),
    AuthModule,
    WhatsappModule,
    CompanyModule,
  ],
  controllers: [
    ExpensesController,
    RecurringExpensesController,
    ExpenseCategoriesController,
  ],
  providers: [
    ExpensesRepository,
    ExpenseCategoriesRepository,
    RecurringExpensesRepository,
    ExpenseRemindersRepository,
    ExpensesService,
    ExpenseCategoriesService,
    RecurringExpensesService,
    ExpensesListener,
    ExpensesCron,
  ],
  exports: [ExpensesService, RecurringExpensesService],
})
export class ExpensesModule {}